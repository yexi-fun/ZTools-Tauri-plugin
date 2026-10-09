import type { ClipboardItem, ClipboardStatus, DialogFileOptions, DialogMessageOptions, FeatureDescriptor, FsEntry, HttpRequestOptions, HttpResponse, InputKeyAction, InputMouseOptions, PluginFeature, PluginWindowOptions, ScreenshotCapture, ScreenshotResult, StorageEntry, SubInputPatch } from './types.js';
/**
 * 插件可调用的宿主命令表。
 *
 * 命令名与 Rust 侧 `#[tauri::command]` 函数名一致（T0-2 发现：Tauri 不支持
 * `domain:action` 形式的命令名，规范落定见 `06 §2`）。参数名按 Tauri 约定用 camelCase。
 */
export interface CommandMap {
    /** 读取剪贴板文本（需 `clipboard.read`）。 */
    clipboard_read_text: {
        args: Record<string, never>;
        result: string;
    };
    /** 写入剪贴板文本（需 `clipboard.write`）。 */
    clipboard_write_text: {
        args: {
            text: string;
        };
        result: null;
    };
    /** 读取插件私有存储（默认允许）。 */
    storage_get: {
        args: {
            key: string;
        };
        result: unknown;
    };
    /** 写入插件私有存储。 */
    storage_set: {
        args: {
            key: string;
            value: unknown;
        };
        result: null;
    };
    /** 删除存储键。 */
    storage_remove: {
        args: {
            key: string;
        };
        result: boolean;
    };
    /** 列出存储条目。 */
    storage_list: {
        args: Record<string, never>;
        result: StorageEntry[];
    };
    /** 清空存储。 */
    storage_clear: {
        args: Record<string, never>;
        result: null;
    };
    /** 弹通知（需 `notification.show`）。 */
    ui_notify: {
        args: {
            title: string;
            body?: string;
        };
        result: null;
    };
    /** 注册动态 feature（需 `features.manage`）。 */
    features_set: {
        args: {
            feature: PluginFeature;
        };
        result: null;
    };
    /** 删除动态 feature。 */
    features_remove: {
        args: {
            code: string;
        };
        result: boolean;
    };
    /** 列出当前插件的功能。 */
    features_list: {
        args: Record<string, never>;
        result: FeatureDescriptor[];
    };
    /** 退出当前插件（投递 `onExit` 并隐藏插件窗口）。 */
    plugin_exit: {
        args: Record<string, never>;
        result: null;
    };
    /** 把 PNG 图片写入系统剪贴板（需 `clipboard.write`）。 */
    clipboard_write_image: {
        args: {
            dataUrl: string;
        };
        result: ScreenshotResult;
    };
    /** 全屏截图（需 `screen.capture`）：返回 PNG data URL 与虚拟屏幕几何。 */
    screen_capture: {
        args: Record<string, never>;
        result: ScreenshotCapture;
    };
    /** 读取最近一次全屏截图（需 `screen.capture`）。 */
    screen_capture_fetch: {
        args: Record<string, never>;
        result: ScreenshotCapture | null;
    };
    /** 把 PNG 保存到 `<data_root>/screenshots/`（需 `screen.capture`）。 */
    screenshot_save_png: {
        args: {
            dataUrl: string;
            fileName?: string;
        };
        result: ScreenshotResult;
    };
    /** 打开插件自建窗口（需 `window.create`）。 */
    plugin_window_open: {
        args: {
            entry: string;
            options?: PluginWindowOptions;
        };
        result: string;
    };
    /** 关闭插件自建窗口（需 `window.create`）。 */
    plugin_window_close: {
        args: {
            label: string;
        };
        result: null;
    };
    /** 设置/更新主面板里的子输入框（T7-1；纯展示能力，无需权限点）。 */
    plugin_ui_sub_input: {
        args: {
            patch?: SubInputPatch;
        };
        result: null;
    };
    /** 请求主面板内容区高度（T7-1）。 */
    plugin_ui_set_height: {
        args: {
            height: number;
        };
        result: null;
    };
    /** 把当前插件视图分离到独立窗口（需 `window.create`；关闭该窗口即吸附回主面板，T7-11）。 */
    plugin_ui_detach: {
        args: Record<string, never>;
        result: string;
    };
    /** 打开本插件 webview 的开发者工具（仅开发模式 `ZTOOLS_PLUGIN_DEV` 可用，T7-12）。 */
    plugin_devtools: {
        args: Record<string, never>;
        result: null;
    };
    /** 本插件的缓存目录（`<data_root>/cache/<plugin-id>`，T7-13；该目录对本插件可读写）。 */
    plugin_cache_dir: {
        args: Record<string, never>;
        result: string;
    };
    /** 打开系统"选择文件 / 目录"对话框（需 `dialog.open`；取消返回 `null`）。 */
    dialog_open_file: {
        args: {
            options?: DialogFileOptions;
        };
        result: string | null;
    };
    /** 打开系统"保存文件"对话框（需 `dialog.open`；取消返回 `null`）。 */
    dialog_save_file: {
        args: {
            options?: DialogFileOptions;
        };
        result: string | null;
    };
    /** 弹出系统消息对话框（需 `dialog.open`）。 */
    dialog_show_message: {
        args: {
            options: DialogMessageOptions;
        };
        result: null;
    };
    /** 用系统默认程序打开外链（需 `shell.openExternal`；只放行 http/https/mailto/tel）。 */
    plugin_shell_open_external: {
        args: {
            url: string;
        };
        result: null;
    };
    /** 用资源管理器打开路径（需 `shell.openExternal`）。 */
    plugin_shell_open_path: {
        args: {
            path: string;
        };
        result: null;
    };
    /** 在资源管理器中定位（选中）路径（需 `shell.openExternal`）。 */
    plugin_shell_show_item_in_folder: {
        args: {
            path: string;
        };
        result: null;
    };
    /** 把路径送入系统回收站（需 `shell.openExternal`）。 */
    plugin_shell_trash: {
        args: {
            path: string;
        };
        result: null;
    };
    /** 播放系统默认提示音（需 `shell.openExternal`）。 */
    plugin_shell_beep: {
        args: Record<string, never>;
        result: null;
    };
    /** 受限 HTTP 请求（需 `network`；宿主侧发起，CSP 不放宽）。 */
    plugin_http_request: {
        args: {
            request: HttpRequestOptions;
        };
        result: HttpResponse;
    };
    /** 模拟一次键盘动作（需 `input.simulate`）。 */
    plugin_input_key: {
        args: {
            key: string;
            modifiers?: string[];
            action?: InputKeyAction;
        };
        result: null;
    };
    /** 输入一段文本（需 `input.simulate`；Unicode 注入，与键盘布局无关）。 */
    plugin_input_type: {
        args: {
            text: string;
        };
        result: null;
    };
    /** 模拟一次鼠标动作（需 `input.simulate`）。 */
    plugin_input_mouse: {
        args: {
            options: InputMouseOptions;
        };
        result: null;
    };
    /** 读取剪贴板里的文件列表（需 `clipboard.read`）。 */
    clipboard_read_files: {
        args: Record<string, never>;
        result: string[];
    };
    /** 把文件列表写入剪贴板（需 `clipboard.write`）。 */
    clipboard_write_files: {
        args: {
            paths: string[];
        };
        result: null;
    };
    /** 读取授权范围内的文本文件（需声明 `fs.read.any` + 已授权范围）。 */
    fs_read_text: {
        args: {
            path: string;
        };
        result: string;
    };
    /** 写入授权范围内的文本文件（需声明 `fs.write.any` + 已授权范围）。 */
    fs_write_text: {
        args: {
            path: string;
            text: string;
        };
        result: null;
    };
    /** 列出授权范围内的目录（需声明 `fs.read.any` + 目录范围）。 */
    fs_list: {
        args: {
            path: string;
        };
        result: FsEntry[];
    };
    /** 列出剪贴板历史（需 `clipboard.read`）。 */
    plugin_clipboard_history_list: {
        args: {
            query?: string | null;
            limit?: number;
        };
        result: ClipboardItem[];
    };
    /** 粘贴一条历史：宿主写回剪贴板并按设置注入 `Ctrl+V`（需 `clipboard.write`）。 */
    plugin_clipboard_history_paste: {
        args: {
            id: string;
        };
        result: ClipboardItem;
    };
    /** 删除单条历史（含图片文件，需 `clipboard.write`）。 */
    plugin_clipboard_history_remove: {
        args: {
            id: string;
        };
        result: boolean;
    };
    /** 清空历史（含图片文件，需 `clipboard.write`）。 */
    plugin_clipboard_history_clear: {
        args: Record<string, never>;
        result: number;
    };
    /** 把一条图片历史转成 PNG data URL（需 `clipboard.read`）。 */
    plugin_clipboard_history_image: {
        args: {
            id: string;
        };
        result: string;
    };
    /** 读取剪贴板监视与历史状态（需 `clipboard.read`）。 */
    plugin_clipboard_status: {
        args: Record<string, never>;
        result: ClipboardStatus;
    };
}
/**
 * 调用宿主命令并把错误归一化为 {@link ZToolsApiError}。
 * @param command 命令名。
 * @param args 命令参数。
 * @returns 宿主返回结果。
 * @throws 参数非法/权限不足/能力不支持时抛出结构化 `ZToolsApiError`。
 */
export declare function call<C extends keyof CommandMap>(command: C, args?: CommandMap[C]['args']): Promise<CommandMap[C]['result']>;
//# sourceMappingURL=commands.d.ts.map