# Managing Files

## Importing and exporting files

To save your files outside of the browser:

1. Select **Download** from the menu.
2. Choose an option:
   - **Download Source File** — download the active source file.
   - **Download ROM Image** — download the compiled ROM, which can be
     used in a standalone emulator.
   - **Download Project as ZIP** — download the active project as a zip.
   - **Download All Changes as ZIP** — download all files in the active
     platform.
   - **Download Debug Symbols** — download the debug symbol file
     produced by the build for use in an external debugger. This option
     is only available with certain toolchains like NES.
3. Choose a location and save the file.

To import source files back into the browser, select **Upload** from the
menu, choose the file, and click **Open**.

## Renaming, deleting, and adding files

The **File** submenu acts on the file in the active editor window:

- **Revert to Original…** — restore the active example to its original
  state, discarding your edits.
- **Rename File…** — rename the active source file. If it is the main
  file, the project reloads under the new name.
- **Delete File…** — remove the active file from the project after
  confirming.
- **Add Include File…** — create a new file and add it to the main file
  with the include directive appropriate for the platform's toolchain
  (`#include` for C, `.include` for assembly, and so on).
- **Add Linked File…** — create a new file and link it into the build
  with a `//#link` or `;#link` directive.

See [Build Directives](build-directives.md) for how include and linked
files are referenced.

## Managing browser storage

Browsers may occasionally delete local files.
Select **File &raquo; Request Local Storage Permissions** to ask the
browser to keep your files permanently.

## Sharing projects

You can share playable links and videos (seven-second animated GIFs) with
others. Playable links contain the project code inside the URL, so you
can share your work without storing it remotely. Some browsers may not
support the resulting URL length.

### Sharing a playable link

1. From the menu, select **Share**.
2. Select **Share Playable Link…**.
3. Select **Copy Direct Link** to copy the link, or **Copy IFRAME Tag**
   to copy an embeddable IFRAME snippet.
4. Click **Close**.

### Recording a video

1. From the menu, select **Share**.
2. Select **Record Video…**. The emulator background turns red while
   recording.
3. When the preview appears, right-click it and choose **Save Image
   As…** to save the animated GIF.
4. Click **Close**.

### Making a cassette audio file

For platforms with cassette support, select **Share &raquo; Make Cassette
Audio…** to export the compiled program as an audio (WAV) file that can
be loaded from a real or emulated cassette drive. This option is hidden
on platforms that don't support it.

## Syncing with GitHub

You can import projects from GitHub repositories, publish your projects,
and push/pull to repositories you have access to. When you publish or
push, the IDE uploads your code and a compiled ROM file.

### Connecting your account

1. From the menu, select **Sync &raquo; Sign in to GitHub…**.
2. Enter your GitHub username and password.

To sign out, select **Sync &raquo; Log out**.

### Importing a project

1. From the menu, select **Sync**, then **Import Project from
   GitHub…**.
2. Enter the repository URL (for example
   `https://github.com/username/reponame`) and click **Import Project**.

To leave the project, select **Leave Repository** from the Project
Selector drop-down. Imported repositories appear under **Repositories**
in the same drop-down.

### Deleting a local repository

1. Select the repository from the Project Selector drop-down.
2. Select **Sync &raquo; Delete Local Repository**.
3. Type **YES** to confirm, then select **OK**.

### Publishing a project

1. From the menu, select **Sync &raquo; Publish Project on GitHub…**.
2. Enter a project name and description.
3. Choose **Public** or **Private** visibility.
4. Select a license.
5. Click **Upload Project**. If you aren't signed in you'll be prompted
   to connect first.

### Pushing and pulling changes

- **Push:** select **Sync &raquo; Push Changes to Repository…**, enter a
  commit message, then **Push Changes**.
- **Pull:** select **Sync &raquo; Pull Latest from Repository**, then
  **OK**. All local files are overwritten; there is no merge in the
  browser.

