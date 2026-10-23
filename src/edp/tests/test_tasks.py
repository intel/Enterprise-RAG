from unittest.mock import patch, MagicMock
from json.decoder import JSONDecodeError
import requests
from app.tasks import process_file_task, delete_file_task, process_link_task, delete_link_task, response_err, read_dpguard_params

def test_read_dpguard_params_from_config():
    with patch('app.tasks.requests.get') as mock_get, \
         patch('app.tasks.FINGERPRINT_ENDPOINT', 'http://fingerprint:6012/v1/system_fingerprint/config'), \
         patch('app.tasks.FINGERPRINT_PIPELINE', 'dataprep'), \
         patch('app.tasks.FINGERPRINT_TENANT', '_global'):
        params = {'toxicity': {'enabled': True}}
        mock_get.return_value = MagicMock(
            status_code=200,
            json=MagicMock(return_value={
                'params_key': 'dataprep_guard',
                'params_kind': 'dataprep_guard',
                'version': 1,
                'values': {'dataprep_guardrail_params': params},
            }),
        )

        assert read_dpguard_params() == params

        # The read is scoped to the dataprep pipeline, per key.
        _, kwargs = mock_get.call_args
        assert kwargs['params']['params_key'] == 'dataprep_guard'
        assert kwargs['params']['pipeline'] == 'dataprep'
        assert kwargs['params']['tenant'] == '_global'

def test_read_dpguard_params_missing_row_is_fail_safe():
    with patch('app.tasks.requests.get') as mock_get:
        mock_get.return_value = MagicMock(status_code=404)
        # A missing row must not crash the task; the guardrail falls back to
        # its own defaults.
        assert read_dpguard_params() is None

def test_read_dpguard_params_unreachable_is_fail_safe():
    with patch('app.tasks.requests.get') as mock_get:
        mock_get.side_effect = requests.exceptions.ConnectionError("connection refused")
        assert read_dpguard_params() is None

def test_read_dpguard_params_malformed_body_is_fail_safe():
    with patch('app.tasks.requests.get') as mock_get:
        # A 200 with an unexpected body must fall back to defaults, not crash.
        mock_get.return_value = MagicMock(
            status_code=200,
            json=MagicMock(return_value={'unexpected': 'shape'}),
        )
        assert read_dpguard_params() is None

def test_response_error_json_reply():
    mock_r = MagicMock()
    mock_r.json.return_value = {'detail': 'Error details'}
    text = response_err(mock_r)
    assert text == 'Error details'

    mock_r = MagicMock()
    mock_r.json.return_value = {'key': 'value'}
    mock_r.text = "{'key': 'value'}"
    text = response_err(mock_r)
    assert text ==  "{'key': 'value'}"

    mock_r = MagicMock()
    mock_r.json.side_effect = JSONDecodeError('JSON error', 'error', 0)
    mock_r.text = "{'key': 'value'}"
    text = response_err(mock_r)
    assert text ==  "{'key': 'value'}"

def test_process_file_task_success():
    with patch('app.tasks.requests.post') as mock_post, \
         patch('app.tasks._keepalive_session') as mock_keepalive, \
         patch('app.tasks.WithEDPTask.minio') as minio, \
         patch('app.tasks.WithEDPTask.db') as mock_db, \
         patch('app.tasks.TEXT_EXTRACTOR_ENDPOINT', 'http://text-extractor:9398/v1/text_extractor'):

        mock_file_db = MagicMock()
        mock_file_db.id = 1
        mock_file_db.bucket_name = 'test_bucket'
        mock_file_db.object_name = 'test_file.txt'
        mock_file_db.etag = 'test_etag'
        mock_file_db.site_name = None
        mock_db.query().filter().first.return_value = mock_file_db

        minio_response_mock = MagicMock()
        minio_response_mock.read.return_value = b'test_data'
        minio.get_object.return_value = minio_response_mock

        # Setup API responses for all processing steps
        delete_response = MagicMock(status_code=200)
        text_extractor_response = MagicMock(status_code=200)
        text_extractor_response.json.return_value = {'loaded_docs': ['doc1', 'doc2']}
        text_compression_response = MagicMock(status_code=200)
        # TextSplitterInput.loaded_docs is a List[TextDoc], so these are dicts with a text field.
        text_compression_response.json.return_value = {'loaded_docs': [
            {'text': 'compressed1', 'metadata': {}}, {'text': 'compressed2', 'metadata': {}}]}
        text_splitter_response = MagicMock(status_code=200)
        text_splitter_response.json.return_value = {'docs': [{'text': 'chunk1', 'metadata': {}}, {'text': 'chunk2', 'metadata': {}}]}
        embedding_response = MagicMock(status_code=200)
        embedding_response.json.return_value = {'embedded_docs': [{'text': 'chunk1', 'embedding': [0.1, 0.2]}]}
        ingestion_response = MagicMock(status_code=200)

        # _keepalive_session returns a mock session used for the text extractor call
        mock_session = MagicMock()
        mock_session.post.return_value = text_extractor_response
        mock_keepalive.return_value = mock_session

        # Configure mock_post to return different responses for remaining requests.post calls
        mock_post.side_effect = [
            delete_response,           # Delete existing data
            text_compression_response, # Text compression
            text_splitter_response,    # Text splitter
            embedding_response,        # First embedding batch
            ingestion_response         # First ingestion batch
        ]

        result = process_file_task(1)
        assert result == True  # noqa: E712

        # Verify status updates
        assert mock_file_db.status == 'ingested'
        assert mock_file_db.job_message == 'Data ingestion completed.'
        assert mock_file_db.task_id == ''

        # Verify the database was committed multiple times (at least once)
        assert mock_db.commit.call_count > 0

        # Verify all API endpoints were called
        assert mock_post.call_count == 5  # 5 calls via requests.post (delete, compression, splitter, embedding, ingestion)
        assert mock_session.post.call_count == 1  # 1 call via keepalive session (text extractor)

def test_process_file_task_file_not_found():
    with patch('app.tasks.WithEDPTask.db') as mock_db:
        mock_db.query().filter().first.return_value = None
        try:
            process_file_task(1)
        except Exception as e:
            assert str(e) == "File with id 1 not found"

def test_delete_file_task_success():
    with patch('app.tasks.requests.post') as mock_post, \
         patch('app.tasks.WithEDPTask.db') as mock_db:

        mock_file_db = MagicMock()
        mock_file_db.id = 1
        mock_db.query().filter().first.return_value = mock_file_db

        mock_post.return_value.status_code = 200

        delete_file_task(1)
        mock_db.delete.assert_called_once_with(mock_file_db)

def test_delete_file_task_file_not_found():
    with patch('app.tasks.WithEDPTask.db') as mock_db:
        mock_db.query().filter().first.return_value = None
        try:
            delete_file_task(1)
        except Exception as e:
            assert str(e) == "File with id 1 not found"

def test_process_link_task_success():
    with patch('app.tasks.requests.post') as mock_post, \
         patch('app.tasks._keepalive_session') as mock_keepalive, \
         patch('app.tasks.WithEDPTask.db') as mock_db:

        mock_link_db = MagicMock()
        mock_link_db.id = 1
        mock_link_db.uri = 'http://example.com'
        mock_db.query().filter().first.return_value = mock_link_db

        # Setup API responses for all processing steps
        delete_response = MagicMock(status_code=200)
        text_extractor_response = MagicMock(status_code=200)
        text_extractor_response.json.return_value = {'loaded_docs': [{'text': 'doc1', 'metadata': {}}]}
        text_compression_response = MagicMock(status_code=200)
        # TextSplitterInput.loaded_docs is a List[TextDoc], so these are dicts with a text field.
        text_compression_response.json.return_value = {'loaded_docs': [
            {'text': 'compressed1', 'metadata': {}}, {'text': 'compressed2', 'metadata': {}}]}
        text_splitter_response = MagicMock(status_code=200)
        text_splitter_response.json.return_value = {'docs': [{'text': 'chunk1', 'metadata': {}}, {'text': 'chunk2', 'metadata': {}}]}
        embedding_response = MagicMock(status_code=200)
        embedding_response.json.return_value = {'embedded_docs': [{'text': 'chunk1', 'embedding': [0.1, 0.2]}]}
        ingestion_response = MagicMock(status_code=200)

        # _keepalive_session returns a mock session used for the text extractor call
        mock_session = MagicMock()
        mock_session.post.return_value = text_extractor_response
        mock_keepalive.return_value = mock_session

        # Configure mock_post to return different responses for remaining requests.post calls
        mock_post.side_effect = [
            delete_response,           # Delete existing data
            text_compression_response, # Text compression
            text_splitter_response,    # Text splitter
            embedding_response,        # First embedding batch
            ingestion_response         # First ingestion batch
        ]

        result = process_link_task(1)
        assert result == True  # noqa: E712

        # Verify status updates
        assert mock_link_db.status == 'ingested'
        assert mock_link_db.job_message == 'Data ingestion completed.'

        # Verify the database was committed multiple times
        assert mock_db.commit.call_count > 0

        # Verify all API endpoints were called
        assert mock_post.call_count == 5  # 5 calls via requests.post (delete, compression, splitter, embedding, ingestion)
        assert mock_session.post.call_count == 1  # 1 call via keepalive session (text extractor)

def test_process_link_task_link_not_found():
    with patch('app.tasks.WithEDPTask.db') as mock_db:
        mock_db.query().filter().first.return_value = None
        try:
            process_link_task(1)
        except Exception as e:
            assert str(e) == "Link with id 1 not found"

def test_delete_link_task_success():
    with patch('app.tasks.requests.post') as mock_post, \
         patch('app.tasks.WithEDPTask.db') as mock_db:

        mock_link_db = MagicMock()
        mock_link_db.id = 1
        mock_db.query().filter().first.return_value = mock_link_db

        mock_post.return_value.status_code = 200

        delete_link_task(1)
        mock_db.delete.assert_called_once_with(mock_link_db)

def test_delete_link_task_link_not_found():
    with patch('app.tasks.WithEDPTask.db') as mock_db:
        mock_db.query().filter().first.return_value = None
        try:
            delete_link_task(1)
        except Exception as e:
            assert str(e) == "Link with id 1 not found"
