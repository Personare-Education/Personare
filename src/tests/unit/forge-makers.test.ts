import { expect, test } from "vitest";
import config from "../../../forge.config";
import pkg from "../../../package.json";

/*
 * Spec: docs/specs/linux-appimage-release.md
 * O release precisa trazer um AppImage para usuarios de Linux.
 */

const APPIMAGE_MAKER = "@reforged/maker-appimage";

function findAppImageMaker() {
  return config.makers?.find(
    (maker) => "name" in maker && maker.name === APPIMAGE_MAKER
  );
}

test("forge.config.ts declares the AppImage maker", () => {
  expect(findAppImageMaker()).toBeDefined();
});

test("AppImage maker only runs on Linux", () => {
  // The maker reports itself as supported everywhere, so without this the
  // Windows publish job would try (and fail) to build an AppImage.
  expect(findAppImageMaker()).toMatchObject({ platforms: ["linux"] });
});

test("AppImage maker launches the executable named after productName", () => {
  expect(findAppImageMaker()).toMatchObject({
    config: { options: { bin: pkg.productName } },
  });
});

test.each(["deb", "rpm"])(
  "%s maker points to the executable named after productName",
  (makerName) => {
    // Packager names the Linux binary after productName, but these makers
    // default to package.json's lowercase name and fail to find it.
    const maker = config.makers?.find(
      (candidate) => "name" in candidate && candidate.name === makerName
    );

    // MakerBase instances keep the constructor argument here until Forge calls prepareConfig.
    expect(maker).toMatchObject({
      configOrConfigFetcher: { options: { bin: pkg.productName } },
    });
  }
);

test("zip maker also builds a portable Windows package", () => {
  const maker = config.makers?.find(
    (candidate) => "name" in candidate && candidate.name === "zip"
  );

  expect(maker).toMatchObject({ platformsToMakeOn: ["darwin", "win32"] });
});

/*
 * Spec: docs/specs/macos-build.md
 * O release precisa trazer um instalador .dmg para usuarios de macOS.
 */

test("dmg maker builds the macOS installer", () => {
  const maker = config.makers?.find(
    (candidate) => "name" in candidate && candidate.name === "dmg"
  );

  expect(maker).toBeDefined();
});

test("fuses plugin re-signs the macOS app ad hoc after flipping the fuses", () => {
  // Flipping fuses edits the Electron binary and breaks its ad hoc signature;
  // Apple Silicon then refuses to open the app ("is damaged").
  const fuses = config.plugins?.find(
    (plugin) => "name" in plugin && plugin.name === "fuses"
  );

  expect(fuses).toMatchObject({
    fusesConfig: { resetAdHocDarwinSignature: true },
  });
});

/*
 * Spec: docs/specs/app-icon.md -- the app and its installers use Personare's
 * icon instead of Electron's.
 */

test("packages the app with Personare's icon", () => {
  // Packager adds .ico (Windows) or .icns (macOS) to this base path.
  expect(config.packagerConfig?.icon).toBe("./assets/icon");
});

test("the Windows installer uses Personare's icon", () => {
  const maker = config.makers?.find(
    (candidate) => "name" in candidate && candidate.name === "squirrel"
  );

  expect(maker).toMatchObject({
    configOrConfigFetcher: { setupIcon: "./assets/icon.ico" },
  });
});

