# ChainForge packager: an on-demand Mac app

`build_app.sh` makes **ChainForge.app**, a small launcher for a Mac that should
only run ChainForge while someone is using it.

- **Double-click** the app (or its Desktop shortcut): ChainForge starts on this
  Mac only (`127.0.0.1`) and opens in your default browser, in a normal tab.
- A **ChainForge icon in the menu bar** shows while it runs, with *Open
  ChainForge*, *Update ChainForge*, *Show Log* and *Quit ChainForge*. Quitting
  stops the server.
- If you forget, it **stops by itself**: each open ChainForge tab sends a
  heartbeat every 5 minutes, and the server stops once none has arrived for 20
  minutes (a notification says so). This also covers the launcher being
  force-quit. Sleep doesn't count: the timer starts again when the Mac wakes.
- Double-clicking again while it runs just opens another ChainForge tab.
- **What counts as "in use":** any request the server accepts (requests from other sites are refused and don't count). So an open
  ChainForge tab keeps it running, even in the background, and so does a
  script or monitoring tool that polls `http://127.0.0.1:8000/`. Close the tabs
  (or choose *Quit ChainForge*) when you are done.

ChainForge runs Python code from flows and serves local files, and has no login,
so it should not be left running unattended. That is the point of all this.

Stopping on idle is **off in ChainForge by default**: `chainforge serve` runs
for as long as you like, and pages send no heartbeats. Only a server started
with `--idle-shutdown MINUTES`, as this app does, stops by itself.

## Install

1. Install [uv](https://docs.astral.sh/uv/getting-started/installation/).
2. Install ChainForge as a uv tool (version 0.3.7.7 or later):

   ```bash
   uv tool install "chainforge[rag]"
   ```

3. Build the app, with a Desktop shortcut, from a copy of this repository
   (`git clone https://github.com/ianarawjo/ChainForge.git`):

   ```bash
   packager/build_app.sh --desktop-shortcut
   ```

   Options: `--dest DIR` (default `~/Applications`), `--port N` (default 8000),
   `--idle-minutes N` (default 20), `--dir PATH` for saved flows, and
   `--chainforge PATH` / `--uv PATH` if they aren't on your `PATH`. Run it
   again after moving or reinstalling ChainForge or uv: the app stores their
   locations.

The app is built on your machine, so macOS doesn't block it. Copying the built
app to another Mac would need signing; build it there instead.

## Updates

The app never updates ChainForge by itself, so a shared machine doesn't change
under the people using it. Instead:

- Once a day, when it starts, it checks PyPI for a newer ChainForge. If there
  is one, a notification says so (once per version), and the menu item reads
  *Update to ChainForge 0.3.7.8…*. The menu's first line shows the version
  running.
- *Update ChainForge…* checks right away. If there's a newer version, it asks
  first, then stops ChainForge (and anything running in it), runs
  `uv tool upgrade chainforge`, and starts it again. Flows are kept. Tabs
  opened before the update need closing: the updated server doesn't recognise
  them. If the update fails, the version you had starts again, and the log
  says why.

This needs ChainForge installed with uv, as above. Apps built before updates
were added have no *Update* item: rebuild them with `build_app.sh`.

## When something goes wrong

- **Logs:** *Show Log* in the menu, or `~/Library/Logs/ChainForge Launcher/`
  (`chainforge.log` for the server, `launcher.log` for the launcher itself).
- **"Something is already using port 8000":** another ChainForge (say, one
  started in a terminal) is running. Stop it, or build with a different
  `--port` -- but note the browser keeps ChainForge's saved state per port.
- **Updating from a terminal instead:** `uv tool upgrade chainforge`, then
  rebuild the app if the `chainforge` command moved.
- **"Can't update ChainForge from here":** ChainForge wasn't installed with
  uv (e.g. with pip). Update it the way it was installed.

## Uninstall

Delete `~/Applications/ChainForge.app`, the Desktop shortcut,
`~/Library/Logs/ChainForge Launcher` and
`~/Library/Application Support/ChainForge Launcher`. Your flows stay where
ChainForge keeps them.

## How it works

- `launcher_core.py` -- the parts that need no GUI: settings, a single-instance
  lock, starting `chainforge serve --idle-shutdown` in its own process group,
  waiting for it, stopping the whole group, telling an idle stop from a
  crash, and checking for and installing updates. Tested in
  `tests/test_packager_launcher.py`.
- `chainforge_menubar.py` -- the menu-bar app, using
  [rumps](https://github.com/jaredks/rumps), run by uv. Its update flow is
  tested, with rumps stood in for, in `tests/test_packager_menubar.py`.
- `build_app.sh` -- writes the app bundle: settings, icons, and a start script
  that runs the launcher with uv.
- The idle shutdown itself is in ChainForge, used only with `--idle-shutdown`:
  `chainforge/idle_shutdown.py` (server) and
  `react-server/src/backend/serverHeartbeat.ts` (page, which sends heartbeats
  only when the server says idle shutdown is on).

## Doing it yourself, without the app

The app is a convenience. The same behaviour from a terminal:

```bash
chainforge serve --host 127.0.0.1 --idle-shutdown 20
```

Open http://127.0.0.1:8000/, and the server stops 20 minutes after the last
ChainForge tab closes (or when you press Ctrl+C). Any launcher that starts it
this way -- an Automator app, a shell alias -- gets the same safety net.
