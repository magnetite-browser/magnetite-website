// What the Settings page works with.
import type { Color, ExtensionInfo, Settings } from "../bridge";

/** Everything the Settings page shows (`get_settings`). */
export interface Info {
  settings: Settings;
  sync_signed_in: boolean;
  profiles: { id: string; name: string; is_default: boolean; ephemeral?: boolean }[];
  spaces: { id: string; title: string; icon?: string; accent?: Color | null; profile_id: string }[];
  active_space: string;
  favorites: { id: string; title: string; url: string; profile_id?: string | null }[];
  archive_count: number;
  version: string;
  /** Git commit of this build, when the build named it. */
  commit: string | null;
  /** Where the source lives (workspace `repository`); `/TODO/` until published. */
  repository: string;
  engine: { chromium: string; cef: string };
  data_dir: string;
  /** Installed extensions of the page in front's profile. */
  extensions: ExtensionInfo[];
  /** Where Chromium keeps its encryption key: macOS Keychain, or its fixed test key (`--mock-keychain`). */
  keychain: "keychain" | "test";
}

/** Changed settings; the page saves them merged into the current ones. */
export type SettingsPatch = Partial<Settings>;
