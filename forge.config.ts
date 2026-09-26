import { FuseV1Options, FuseVersion } from "@electron/fuses";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { VitePlugin } from "@electron-forge/plugin-vite";
import type { ForgeConfig } from "@electron-forge/shared-types";
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
  },
  makers: [
    new MakerSquirrel({}),
    // win32: portable build, extract and run Personare.exe without installing.
    new MakerZIP({}, ["darwin", "win32"]),
    // Packager names the Linux binary after productName; these default to package.json's name.
    new MakerRpm({ options: { bin: "Personare" } }),
    new MakerDeb({ options: { bin: "Personare" } }),
    {
      // ESM-only package: referenced by name so Forge loads it with import().
      config: { options: { bin: "Personare", categories: ["Education"] } },
      name: "@reforged/maker-appimage",
      // The maker claims support on every platform; the Windows job has no mksquashfs.
      platforms: ["linux"],
    },
  ],
  packagerConfig: {
    asar: true,
    extraResource: ["./drizzle"],
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
          owner: "jopsfernandes",
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
