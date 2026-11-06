# Larab's CleanFrame trial

Start with the Mac preview, then install an independently signed copy as an app you open from the TV's Apps screen. This trial covers the interface and everyday remote navigation. Home Assistant is a later phase.

| Item | Trial setup |
| --- | --- |
| Fork | [Loshay1/CleanFrame](https://github.com/Loshay1/CleanFrame) |
| Branch | `trial/personal-home`, based on upstream v0.7.0 |
| Mac checkout | `/Users/larabmohsin/Projects/CleanFrame` |
| TV | Samsung The Frame `QN55LS03DAFXZA` |
| Firmware from the TV photo | `T-PTMDAKUC-0090-2130.0` |
| Existing Mac tools | Node 24.22.2, npm 12.2.2 and Python; the preview requires Python 3.10+ |
| SDK status | `tizen` and `sdb` were not on PATH at the machine check; installation, actual paths and M4 compatibility still need verification |

The upstream native Home helper is guarded for `QA55LS03DAWXXY` and `T-PTMDUABC-0090-2130.0`. Those are different from this TV. Do not run the native helper, widen its guards, or apply Home/startup changes for this trial. The shared `2130.0` suffix does not establish compatibility. See the [reference device record](tv-status.md).

## 1. Preview on the Mac

In Terminal:

```sh
cd /Users/larabmohsin/Projects/CleanFrame
git status --short
git fetch origin
git switch trial/personal-home
npm ci && npm run dev:public
```

If Git reports local edits or refuses the branch switch, preserve that work and resolve the checkout before continuing. Do not reset it to force the switch.

Open **http://localhost:4795/home/**. Leave Terminal running; **Control-C** stops the preview. The server is local to the Mac. It uses the bundled public fonts and does not require Samsung tools or a TV connection.

Use **arrow keys** to move, **Enter** to select, and **Escape** to go back. Clicking controls also works. In Dock layout, Left/Right selects apps and Up reaches the top-right controls, including Settings. A focused setting is applied with Enter; there is no separate Save button. App launches, installed-app discovery, HDMI and Samsung screens require the physical TV.

### Try the personal settings

| Feature | What to try |
| --- | --- |
| Apple TV-inspired dock | In **Settings → Layout**, select **Dock** and the **Tiles** style. Compare with **Classic**. This changes CleanFrame's presentation; it does not add tvOS or Apple TV hardware features. |
| Weather | Enable weather in Settings. The trial uses **Chicago**, defaults to **°F**, and offers **°C** and an off switch. Data comes from [Open-Meteo](https://open-meteo.com/en/docs); internet access is required. Weather in the Mac preview does not prove the TV can fetch it. |
| Photos | Choose **Settings → Background → Photo**, then **Wallpaper** to select one of the 15 bundled images. |
| Rotation | **Settings → Background → Rotation** offers **Fixed**, **Each time Home opens**, **Every 5 minutes**, **Every 15 minutes**, and **Every hour**. Start with Fixed, then try 5 minutes. |
| Apps | Use **Settings → Apps on Home** to reorder/remove shortcuts. The TV can discover installed consumer apps; the browser cannot establish their availability. |

Rotation uses the existing bundled collection. “Each time Home opens” advances on a fresh launcher load, not every return to an already-running app. Timed rotation counts visible Photo Home time; Settings, other panels and other apps pause it. Launcher wallpaper is separate from Samsung's native Art Mode. Personal photo imports, live iCloud albums and Home Assistant controls are outside this first trial.

## 2. Prepare the official Mac tools

Samsung currently recommends the [VS Code Tizen extension](https://samsungtizenos.com/tools-download/). Its macOS CLI download is Tizen SDK 10; the [TV extension download](https://developer.samsung.com/smarttv/develop/tools/tv-extension/download.html) lists 10.0.0. Check the installed versions rather than treating these as a completed installation.

On the M4, treat SDK operation as a compatibility check: Samsung's [published prerequisite source](https://github.com/Samsung/tizen-docs/blob/master/docs/sdk-tools/baseline-sdk/setup/prerequisites.md) still lists Mac hardware as x64. Native Apple Silicon support was not established by the documentation review. If an Intel tool requires Rosetta, use Apple's prompt or [documented command](https://support.apple.com/en-us/102527):

```sh
softwareupdate --install-rosetta
```

For the current VS Code route:

1. Install **Tizen Extension** (`tizen.vscode-tizen-csharp`) from Extensions. Open the Tizen Activity Bar view and complete SDK setup. Its current default Mac path is `/Users/<username>/.tizen-extension-platform`.
2. Install **Tizen TV**, publisher **samsungtvsdk**. In **Tizen → Packages → Advanced**, install the current TV extension.
3. Install the Tizen CLI through **Tizen: Install Tizen CLI** if it is not present. This repository needs the SDK files `tools/ide/bin/tizen` and `tools/sdb`; record the directory containing them.
4. Confirm Samsung certificate support is available. In classic Tizen Studio's Package Manager, install **Samsung Certificate Extension** alongside the TV extension. Certificate Extension versions older than **2.0.73** cannot issue certificates after September 2025.

Use the supported wizard actually supplied by the installed tools. Do not assume the new extension's directory layout matches the older CLI packager. Keep the SDK in a directory without spaces if its launcher fails on a spaced path.

Official instructions: [Tizen extension installation](https://github.com/Samsung/tizen-docs/blob/master/docs/sdk-tools/vscode-ext/Tizen/dotnet.md), [TV extension setup](https://developer.samsung.com/smarttv/develop/tools/additional-tools/vscode-extension-new.html), and [Samsung SDK/certificate extension setup](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/installing-tv-sdk.html).

## 3. Enable Developer Mode at the TV

Connect the Mac and TV to the same local network. Record both local IP addresses; the Developer Mode popup needs the **Mac's** address, while the connection tool needs the **TV's** address.

1. Open **Home → Apps → App Settings**.
2. Open the remote's numeric keypad with **123**; select **1, 2, 3, 4, 5** in order. Select Done if shown.
3. Set **Developer Mode → On**, enter the Mac's local IP as the host/computer IP, and save.
4. Follow the TV's restart instruction. Reopen Apps and check for the **Develop Mode** indication.

This is Samsung's [developer connection procedure](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/tv-device.html). Use a screen/remote photo if the menu differs. A short Power press can enter Art Mode instead of restarting; if the connection later fails, check addresses and the restart state first. A full power cycle may be needed, but coordinate it while the TV is idle. No service-menu changes or router port forwarding are needed.

## 4. Create your signing profile and app identity

In the current VS Code workflow, use **Tizen → Actions → Connect Device → + Create Custom Connection**. Enter the TV IP and **port 26101**, add it, then Connect. In classic Studio, the equivalent is **Tools → Device Manager → Remote Device Manager → +**.

Next use **Actions → Create Certificate → Create Samsung Certificate**. Supply a profile name and author details, choose the distributor settings, select this TV's **DUID**, and complete Samsung account sign-in. Larab should enter passwords and verification codes himself. Classic Studio uses **Tools → Certificate Manager → + → Samsung → TV**.

Prefer the connected-device DUID selector. A DUID is different from the model number and serial number. Samsung's manual fallback is **Menu → Support → Contact Samsung → Unique Device ID**, with wording dependent on the TV menus. Verify that the profile was saved and back up the author certificate; future updates to the same app should retain it. See Samsung's [VS Code certificate guide](https://developer.samsung.com/smarttv/develop/tools/additional-tools/vscode/creating-certificates.html) and [classic certificate guide](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/creating-certificates.html).

Use the official SDK's **TV Web Application** project wizard with a Basic/Empty template to generate your own application identity. Read that temporary project's `config.xml`: the `package` and `id` attributes of `<tizen:application>` are the two values needed below. Do not reuse the maintainer's IDs. See [Samsung's project guide](https://developer.samsung.com/smarttv/develop/getting-started/creating-tv-applications.html).

Create the ignored local settings without overwriting an existing configuration:

```sh
cd /Users/larabmohsin/Projects/CleanFrame
mkdir -p .local
cp -n signing.example.json .local/signing.json
open -e .local/signing.json
```

Replace all placeholders with the verified values:

```json
{
  "sdk_path": "/ACTUAL/PATH/TO/THE/CLI/SDK",
  "profile": "YOUR_SAVED_SAMSUNG_PROFILE",
  "package_id": "YOUR_SDK_GENERATED_PACKAGE_ID",
  "app_id": "YOUR_SDK_GENERATED_FULL_APPLICATION_ID",
  "password_file": null
}
```

The SDK-generated package ID must be ten alphanumeric characters; the full app ID begins with that ID plus a dot. Keep `password_file` null to use SDK-managed password access. Do not put passwords into this JSON or Git. Save the TV address in ignored `.local/device.json`:

```json
{"host": "YOUR_TV_IP_ADDRESS"}
```

Configure the official CLI to use the existing certificate profile if necessary. In classic Device Manager, right-click this connected TV and select **Permit to install applications**. The detailed [local signing documentation](development.md#local-tv-tools-and-signing) explains SDK profile selection and password handling.

## 5. Sign, install and launch the standalone app

Only proceed after the two local JSON files contain real values and the tools run successfully. These commands announce a normal app installation/launch stage; have the TV available to observe the result.

Load the verified configuration into this Terminal session:

```sh
cd /Users/larabmohsin/Projects/CleanFrame
CLEANFRAME_SDK="$(python3 -c 'import sys; sys.path.insert(0, "scripts"); from local_config import load_settings; print(load_settings()["sdk_path"])')"
CLEANFRAME_APP_ID="$(python3 -c 'import sys; sys.path.insert(0, "scripts"); from local_config import load_settings; print(load_settings()["identity"]["app_id"])')"
CLEANFRAME_HOST="$(python3 -c 'import json, ipaddress; from pathlib import Path; print(ipaddress.ip_address(json.loads(Path(".local/device.json").read_text())["host"]))')"
CLEANFRAME_SERIAL="$CLEANFRAME_HOST:26101"

test -x "$CLEANFRAME_SDK/tools/sdb"
test -x "$CLEANFRAME_SDK/tools/ide/bin/tizen"
"$CLEANFRAME_SDK/tools/sdb" version
"$CLEANFRAME_SDK/tools/ide/bin/tizen" help
```

Stop if any configuration/tool check fails. Then sign locally:

```sh
npm run package
```

Proceed only when packaging exits successfully and reports **Signed widget created**. The output is `dist/CleanFrame.wgt`. A failed signing attempt preserves the previous successful widget, so an existing file alone does not prove this build succeeded. The public export `dist/CleanFrame-public-unsigned.wgt` cannot be installed as a signed personal build.

Connect and confirm the intended device:

```sh
"$CLEANFRAME_SDK/tools/sdb" connect "$CLEANFRAME_SERIAL"
"$CLEANFRAME_SDK/tools/sdb" devices
"$CLEANFRAME_SDK/tools/sdb" -s "$CLEANFRAME_SERIAL" capability
```

Record this TV's actual Tizen version and architecture; the firmware photograph alone does not supply them. Then use Samsung's documented CLI:

```sh
"$CLEANFRAME_SDK/tools/ide/bin/tizen" install \
  -s "$CLEANFRAME_SERIAL" --name CleanFrame.wgt -- "$PWD/dist"
```

After successful installation:

```sh
"$CLEANFRAME_SDK/tools/ide/bin/tizen" run \
  -s "$CLEANFRAME_SERIAL" -p "$CLEANFRAME_APP_ID"
```

For TV commands, `-p` requires the **full application ID**, despite the option's `pkgid` name. See [Samsung's install/run/uninstall reference](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/command-line-interface.html).

Confirm CleanFrame is in Apps and visibly opens. An upload message or launch callback alone is insufficient. The repository's `npm run tv:install` uses a reference-device `vd_appinstall` transport; do not substitute it blindly if the normal CLI fails. Inspect the error and target assumptions first. No native Home helper is needed to diagnose this stage.

## 6. Verify on the physical TV

Use the normal remote and record visible results:

1. Open CleanFrame from **Apps**; navigate Tiles, Classic and Settings. Compare readability and focus motion from the couch.
2. Turn weather on, verify Chicago and °F, switch to °C, then turn it off. Check the display after leaving and reopening the app. Record any loading/error state honestly.
3. Choose a wallpaper and 5-minute rotation. Leave Photo Home visible long enough to see a change; open Settings and confirm the timer pauses. Restore Fixed if preferred.
4. Discover the TV's installed apps, configure the desired shortcuts, and launch at least two available services. Verify actual destinations; do not assume the reference catalogue's IDs apply.
5. Press physical **Home** and confirm Samsung's normal interface is accessible. Reopen CleanFrame from Apps and confirm preferences persist.

This trial does not promise that physical Home, normal power-on or Art Mode wake will automatically select CleanFrame. Those behaviors need a separate, compatible implementation and physical verification.

### Verification record

At guide preparation, the checks below were **pending for this personal trial**. Replace this table with actual evidence as the work completes; upstream results are not results for this TV.

| Check | Status |
| --- | --- |
| Source, tool and public-package checks | Pending final local run |
| Browser navigation, Tiles/Classic, weather states and rotation | Pending final browser run |
| Live Open-Meteo request from the Mac | Pending observation |
| M4 SDK execution, Samsung signing and package identity | Pending |
| TV installation, visible launch and remote operation | Pending |
| TV weather networking and photo rotation | Pending |

For repeatable local validation after changes:

```sh
npm run check
npm run check:tools
npx playwright install chromium
CLEANFRAME_PUBLIC_FONTS=1 npm run check:browser
npm run check:public
npm run export:public
```

These are source/browser/package checks. Even `check:device` uses a synthetic adapter and does not contact the TV. A successful run is not hardware certification.

## Roll back the trial

For appearance only, select **Classic**, turn weather off, and choose **Fixed** rotation. Stop the Mac preview with Control-C when finished.

To remove the TV app, choose **Home → Apps → App Settings → CleanFrame → Delete**, following [Samsung's 2024 app-management guide](https://www.samsung.com/sg/support/tv-audio-video/how-to-use-apps-on-a-2024-samsung-smart-tv/). Or, in the configured Terminal session above:

```sh
"$CLEANFRAME_SDK/tools/ide/bin/tizen" uninstall \
  -s "$CLEANFRAME_SERIAL" -p "$CLEANFRAME_APP_ID"
"$CLEANFRAME_SDK/tools/sdb" disconnect "$CLEANFRAME_SERIAL"
```

Keep the author certificate and local identity if you may reinstall/update this app. To end developer access, reopen the `12345` popup, turn Developer Mode off and restart as prompted. This standalone trial requires no native Home restore operation because it does not change native Home/startup settings.
