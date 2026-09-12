# Managing Files

## Importing and exporting files

If you plan to clear cookies, or move between browsers or computers, you
may need to export your work and import it later.

To save your files outside of browser cache:

1. Select **Download** from the menu.
2. Choose an option:
   - **Download Source File** — download the active source file.
   - **Download ROM Image** — download the compiled ROM, which can be
     used in a standalone emulator.
   - **Download Project as Zip** — download the active project as a zip.
   - **Download All Changes as Zip** — download all files in the active
     platform.
3. Choose a location and save the file.

To import source files back into the browser, select **Upload** from the
menu, choose the file, and click **Open**.

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

## Syncing with GitHub

You can import projects from GitHub repositories, publish your projects,
and push/pull to repositories you have access to. When you publish or
push, the IDE uploads your code and a compiled ROM file.

### Connecting your account

1. From the menu, select **Sync &raquo; Sign in to GitHub…**.
2. Enter your GitHub username and password.

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

