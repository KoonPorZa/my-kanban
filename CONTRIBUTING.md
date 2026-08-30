# Contributing

This repository uses Gitflow to keep feature development, integration, and
production releases separate. All code changes must pass the workspace checks
before they move into `develop` or `main`.

## Branch roles

Use each long-lived branch for one purpose.

- `main` contains production release commits and release tags.
- `develop` contains integrated work for the next release.
- `feature/<name>` contains one feature and starts from `develop`.
- `release/<version>` stabilizes a release and starts from `develop`.
- `hotfix/<name>` repairs production and starts from `main`.

Don't commit feature work directly to `main` or `develop`.

## Feature workflow

Use this sequence for normal feature development.

1. Update your local `develop` branch.
2. Create `feature/<short-kebab-case-name>` from `develop`.
3. Keep commits focused and use Conventional Commit messages.
4. Run the required validation commands.
5. Merge the reviewed feature into `develop`.
6. Delete the feature branch after the merge is complete.

## Release workflow

Use a release branch when `develop` is ready for production.

1. Create `release/<version>` from `develop`.
2. Apply release-only fixes and update version documentation.
3. Merge the release into `main` and tag the release.
4. Merge the release back into `develop`.

## Hotfix workflow

Use a hotfix branch only for urgent production corrections.

1. Create `hotfix/<short-kebab-case-name>` from `main`.
2. Implement and validate the smallest safe fix.
3. Merge the hotfix into both `main` and `develop`.
4. Tag the corrected release on `main`.

## Required validation

Run these commands before you merge a branch.

```sh
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm build
```

Never commit `.env`, OAuth secrets, session secrets, database credentials, or
other local environment files.
