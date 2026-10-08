# Contributing

We welcome community contributions to Intel® AI for Enterprise RAG.

## Table of contents

- [How to contribute](#how-to-contribute)
- [License and conduct](#license-and-conduct)
- [Contributing code](#contributing-code)
  - [Fork the repository](#1-fork-the-repository)
  - [Create a branch](#2-create-a-branch)
  - [Commit your changes](#3-commit-your-changes)
  - [Sign your work](#4-sign-your-work)
  - [Open a pull request](#5-open-a-pull-request)
- [Coding guidelines](#coding-guidelines)
- [Commits guidelines](#commits-guidelines)
- [Pull request guidelines](#pull-request-guidelines)
- [Contributing across the AI Solutions portfolio](#contributing-across-the-ai-solutions-portfolio)
- [Pull request activity and review process](#pull-request-activity-and-review-process)


## How to contribute

You can:
- log a bug, feedback, enhancement proposal, or idea with an [issue][ai-erag-issues]
- submit your changes with a [pull request][ai-erag-pulls]

## License and conduct

By contributing to the project, you agree to the terms in [`LICENSE`](LICENSE) and copyright terms therein and release your contribution under these terms.

All contributors must follow [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).


## Contributing code

To submit code:

### 1. Fork the repository

```bash
git clone https://github.com/<your-github-username>/<repository>.git
cd <repository>
git remote add upstream https://github.com/intel/<repository>.git
```

### 2. Create a branch

Start from the latest `main` branch to reduce merge conflicts, then create a branch for your change:

```bash
git switch main
git pull --ff-only upstream main
git switch -c <your-branch-name>
```

Choose any short, descriptive branch name. As a convention, you can prefix it with your GitHub username, followed by `/` and a brief description; for example: `johndoe/update-contributing-guide`.


### 3. Commit your changes

When making changes, follow the [coding guidelines](#coding-guidelines) and the [commits guidelines](#commits-guidelines) when writing commit messages. Keep your branch up to date with the latest `main`. Add or update tests as needed and run the relevant tests locally before submitting your changes.

> [!IMPORTANT]
> Never commit credentials, secrets, or confidential information. Do not include unexplained binary or generated files.


#### 4. Sign your work
Every commit requires a Developer Certificate of Origin sign-off:

```bash
git commit -s -m "Describe the change"
```

This adds:

```text
Signed-off-by: Your Name <your.email@example.com>
```

Use your real name and an email associated with your GitHub account. If you set your `user.name` and `user.email` git configs, you can sign your commit automatically with `git commit -s`.


### 5. Open a pull request

Push your branch to your fork and open a pull request to the `main` branch that follows the [pull request guidelines](#pull-request-guidelines).


Your pull request will be automatically tested by pre-commit and marked as "green" if all checks have passed and the pull request is ready for maintainer review.

If any builders fail, the status is "red," you need to fix the issues listed in console logs. Any change to the pull request branch will automatically trigger a new set of checks.


> [!NOTE]
> Include links to related pull requests in other repositories when applicable. See [Contributing across the AI Solutions portfolio](#contributing-across-the-ai-solutions-portfolio) for guidance on coordinating changes across repositories.


We'll make sure to review your Pull Request as soon as possible and provide you with our feedback. You can expect a merge once your changes are validated with automatic tests and approved by maintainers.

## Coding guidelines

### Copyright headers

All source files must carry the standard AI Solutions copyright header. For new files, use the current year.

Python (`.py`):
```python
  # Copyright (C) 2025-2026 Intel Corporation
  # SPDX-License-Identifier: Apache-2.0
```

## Commits guidelines

Write commit messages following the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification. Supported commit types:

- `fix`: bug fixes
- `feat` / `add`: new features
- `docs`: documentation changes
- `test`: test updates
- `refactor`: code improvements without functional changes
- `perf`: performance improvements
- `build`: build tooling or dependency changes
- `ci`: CI/CD workflow changes


## Pull request guidelines

### General rules

* Give your branches, commits, and Pull Requests meaningful names and descriptions.
* Your pull request should be rebased against the current main branch.
* Make your PRs small - each PR should address one issue. Remove all changes unrelated to the PR.
* Link your Pull Request to an issue if it addresses one.
* For Work In Progress, or checking test results early, use a Draft PR. you can submit it with the PR title including [WIP] and list Todo items in the desciption to easier follow what is still missing


### Before requesting a review
- Ensure your changes have been validated locally.
- Add or update tests to cover any new or modified behavior.
- Add new documentation or update existing documentation where applicable.
- Include the required [license header](#copyright-headers) in all newly created source files.


### Write a clear pull request title

Use one of these formats:

```text
<type>: <short description>
<type>(<scope>): <short description>
```

Where:

* **`type`** — follows the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) convention and indicates the type of change, such as `feat`, `fix`, `docs`, `test`, `ci`, etc.
* **`scope`** — when a change primarily affects one area, consider specifying the corresponding scope identifies the component, module, or area affected by the change. See the [change scope](#change-scope) section for examples.

Examples:

```text
feat(prompt_template): add contextual system templates for RAG pipelines
fix(ui): attach RBAC bearer token to S3 download requests
docs: update default models in docs
test(e2e): add validation test for link ingestion
ci: add linter configuration
```

#### Change scope

Add one short scope to the title when it helps identify the part of the project affected. Choose the closest area; omit the scope if none fits. For this repository, use names such as:

- `<microservice>` — a single microservice under `src/comps/`, for example `embeddings`, `llms`, `retrievers`, `prompt_template`, `guardrails`, `text_extractor`, `text_splitter`, etc.
- `edp` — Enhanced Dataprep Pipeline in `src/edp/`
- `gmc` — GenAI Microservices Connector in `src/gmc/`
- `ui` — Enterprise RAG UI in `src/ui/`
- `deployment` — Ansible roles, Helm charts, pipelines, and manifests in `deployment/`
- `debug-tool` — deployment debug tooling in `deployment/tools/`


### Pull request content

Every pull request must include:

- **Description:** Explain the purpose of the change and link related issues, tickets, or pull requests when applicable.
- **Tests:** List the commands, test scenarios, and validation steps used to verify the change.

When a repository provides a pull request template, follow its structure and complete all applicable sections. Mark sections that do not apply as N/A when appropriate.

Include additional context that may help reviewers assess the change, when applicable:

 - Related pull requests in other repositories, including any required merge order. See [Contributing across the AI Solutions portfolio](#contributing-across-the-ai-solutions-portfolio) for guidance.
 - User-visible behavior, configuration changes, upgrade or migration steps, and compatibility impact.
 - Security considerations, known limitations, and follow-up work.
 - Documentation updates, relevant logs, screenshots, or before-and-after examples.
 - Any other information requested by the repository's pull request template.


## Contributing across the AI Solutions portfolio

Intel® AI for Enterprise Solutions is delivered as a portfolio of related projects maintained across multiple repositories. Each repository owns a specific layer or capability, while [`enterprise-ai-solutions`][ai-solutions] serves as the parent integration repository that assembles and releases the complete solution.

Intel® AI for Enterprise RAG is one of the solutions within this portfolio. It uses the shared layers provided by AI Solutions, as well as capabilities from other portfolio solutions, such as [enterprise-inference][ai-inference], which provides inference and model-serving functionality.


Repositories relevant to Enterprise RAG include:
- [`enterprise-ai-solutions`][ai-solutions] - repository containing all solutions, including Enterprise RAG
- [`enterprise-inference`][ai-inference] - inference service used by Enterprise RAG.


When implementing a feature or a fix, contributors should make changes in the repository that owns the functionality:
  - changes to Enterprise RAG functionality belongs to this repository.
  - If the change requires adjustments in the inference layer that Enterprise RAG consumes, the corresponding changes must also be made in [`enterprise-inference`][ai-inference].
  - If the change affects the integration layer provided by [`enterprise-ai-solutions`][ai-solutions], the corresponding updates must also be be made in that repository.


This may involved:
- updating the component revision reference in configs/repos (required only in the parent repository,[`enterprise-ai-solutions`][ai-solutions])
- adjusting solution or deployment configuration when required,
- updating documentation,
- updating tests and validation assets when applicable.


When a contribution spans multiple repositories:

1. Create a separate pull request for each affected repository.
2. Link the related pull requests.
4. Complete review and CI validation for every pull request.
5. Merge the AI Solutions integration change only after the required component changes are available.


A contribution is considered complete only when all affected repositories are updated and the change is fully integrated into the parent repository, [`enterprise-ai-solutions`][ai-solutions].


## Pull request activity and review process

### What is considered activity

A Pull Request (PR) is considered **active** when there is meaningful progress, such as:

* Code updates addressing review feedback
* Technical discussion resolving open questions
* Significant rework or design clarification


### Response expectations

After review feedback is provided:

* Contributors are expected to respond within **21 days**
* If there is no response, the PR may be considered **inactive**

This helps ensure that review bandwidth is focused on contributions that are actively progressing.


### Stale pull requests

If a PR becomes inactive:

* A maintainer may mark it with a `stale` label
* A reminder comment may be added requesting an update

This is a signal that the PR requires attention to continue review.


### Closing inactive pull requests

If there is no meaningful activity within **7 days after being marked as stale**:

* The PR may be **closed by maintainers**

Closing a PR due to inactivity:

* Is an **administrative action**, not a rejection
* Does **not prevent resubmission** of the contribution later


### Continuing or reviving work

If a PR has been closed due to inactivity:

* Contributors are welcome to reopen it (if possible), or
* Submit a new PR referencing the previous work

Maintainers will resume the review once activity continues.


### Maintainer continuation

To avoid losing valuable contributions:

* If a PR is inactive but relevant, maintainers may:
  * Continue work directly on top of the PR, or
  * Create a follow-up PR based on the original contribution

In such cases, credit to the original author will be preserved.

[ai-solutions]: https://github.com/intel/enterprise-ai-solutions
[ai-inference]: https://github.com/intel/enterprise-inference
[ai-erag]: https://github.com/intel/enterprise-rag
[ai-erag-issues]: https://github.com/intel/enterprise-rag/issues
[ai-erag-pulls]: https://github.com/intel/enterprise-rag/pulls