# PDF-Viewer-Lib
A Headless PDF Viewer Lib for ReactJS

## Publishing to npm

This repository uses the same Changesets release flow as Canny-UI. `.github/workflows/publish.yml` runs on pushes to `main` and can also be started manually from Actions.

### One-time setup

- In npm settings for `@cannymindstech/pdf-viewer`, add a GitHub Actions trusted publisher: owner `CannyMinds`, repository `PDF-Viewer-Lib`, workflow filename `publish.yml`, environment blank, and **Allow npm publish** enabled. No npm token secret is needed.
- In GitHub **Settings → Actions → General → Workflow permissions**, enable **Allow GitHub Actions to create and approve pull requests**. Organization settings must permit it. The workflow requests write permissions for contents and pull requests.

### Releasing changes

1. Run `pnpm changeset`, select `@cannymindstech/pdf-viewer`, choose a version bump, and enter a summary. Commit the generated `.changeset/*.md` file with your code.
2. Push or merge to `main`. The workflow creates or updates a **chore: release packages** PR containing the version bump and changelog.
3. Review and merge that PR. The next workflow run builds and publishes the unpublished package version, then creates a GitHub release. No manual release or tag is needed.

A push without pending changesets publishes the current package version if it is absent from npm; an already published version is skipped. This is also Canny-UI's behavior. Prefer changesets over manual version bumps.

For prereleases, use Changesets prerelease mode (`pnpm changeset pre enter next`) before versioning. See [Changesets documentation](https://github.com/changesets/changesets).

When a file viewer release needs a new PDF viewer version, publish the PDF viewer first, then update the file viewer dependency and lockfile and add its changeset.
