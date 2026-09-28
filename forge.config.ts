import { FuseV1Options, FuseVersion } from "@electron/fuses";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerDMG } from "@electron-forge/maker-dmg";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { VitePlugin } from "@electron-forge/plugin-vite";
import type { ForgeConfig } from "@electron-forge/shared-types";
import { adHocSignMacApps } from "./scripts/ad-hoc-sign";
import { copyExternalModules } from "./scripts/copy-external-modules";
import { EXTERNAL_MODULES } from "./scripts/external-modules";

const config: ForgeConfig = {
  hooks: {
    packageAfterCopy: async (
      _forgeConfig,
      buildPath,
      _electronVersion,
      platform,
      arch
    ) => {
      await copyExternalModules(buildPath, { arch, platform });
    },
    // Last, once the fuses are flipped: the whole macOS bundle must carry a
    // valid ad hoc signature, or Apple Silicon calls the app "damaged".
    postPackage: async (_forgeConfig, { outputPaths, platform }) => {
      await adHocSignMacApps(platform, outputPaths);
    },
  },
  makers: [
    new MakerSquirrel({ setupIcon: "./assets/icon.ico" }),
    // macOS installer: drag Personare into Applications.
    new MakerDMG({}),
    // win32: portable build, extract and run Personare.exe without installing.
    new MakerZIP({}, ["darwin", "win32"]),
    // Packager names the Linux binary after productName; these default to package.json's name.
    new MakerRpm({ options: { bin: "Personare", icon: "./assets/icon.png" } }),
    new MakerDeb({ options: { bin: "Personare", icon: "./assets/icon.png" } }),
    {
      // ESM-only package: referenced by name so Forge loads it with import().
      config: {
        options: {
          bin: "Personare",
          categories: ["Education"],
          icon: "./assets/icon.png",
        },
      },
      name: "@reforged/maker-appimage",
      // The maker claims support on every platform; the Windows job has no mksquashfs.
      platforms: ["linux"],
    },
  ],
  packagerConfig: {
    asar: true,
    extraResource: ["./drizzle"],
    // Packager adds .ico (Windows) or .icns (macOS); see docs/specs/app-icon.md.
    icon: "./assets/icon",
  },
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      build: [
        {
          config: "vite.main.config.mts",
          entry: "src/main.ts",
          target: "main",
        },
        {
          config: "vite.preload.config.mts",
          entry: "src/preload.ts",
          target: "preload",
        },
      ],
      renderer: [
        {
          config: "vite.renderer.config.mts",
          name: "main_window",
        },
      ],
    }),

    new FusesPlugin({
      // Flipping fuses edits the Electron binary and breaks its ad hoc
      // signature, which Apple Silicon requires to open the app at all.
      // Only acts on a macOS .app bundle.
      resetAdHocDarwinSignature: true,
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  publishers: [
    {
      config: {
        draft: true,
        prerelease: true,
        repository: {
          name: "Personare",
          owner: "Personare-Education",
        },
      },
      /*
       * Publish release on GitHub as draft.
       * Remember to manually publish it on GitHub website after verifying everything is correct.
       */
      name: "@electron-forge/publisher-github",
    },
  ],
  rebuildConfig: {
    // External modules ship N-API prebuilds that work on any Electron version,
    // and copyExternalModules leaves out the sources a rebuild would need.
    ignoreModules: EXTERNAL_MODULES,
  },
};

export default config;
