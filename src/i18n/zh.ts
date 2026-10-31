import type { MessageKey } from './en';

export const zh: Record<MessageKey, string> = {
  'common.cancel': '取消',
  'common.reset': '重置',
  'common.save': '保存',
  'common.enabled': '启用',
  'settings.general': '通用',
  'settings.debug': '调试日志',
  'settings.debugDesc': '在开发者控制台输出额外诊断信息。',
  'settings.feature.enabled': '启用',
  'settings.feature.reset': '重置此特性',
  'settings.feature.resetDesc': '将此特性的设置恢复为默认值。',
  'settings.feature.resetTitle': '重置特性设置',
  'settings.feature.resetConfirm':
    '确定要重置“{name}”的所有设置吗？此操作无法撤销。',
  'notice.featureEnableFailed':
    '启用“{name}”失败，请查看开发者控制台中的详细信息。',
  'notice.settingsSaveFailed':
    '保存插件设置失败，请查看开发者控制台中的详细信息。',

  'features.attachments.name': '附件管理',
  'features.attachments.description':
    '将粘贴的图片和上传的文件保存到配置的附件目录，并保留笔记的目录结构。',
  'features.attachments.assetsRoot': '附件根目录',
  'features.attachments.assetsRootDesc':
    'Vault 相对路径。笔记 dir/dirb/note.md 会保存到 assets/dir/dirb/。输入 /assets 会规范化为 assets。',
  'features.attachments.filenamePattern': '粘贴图片文件名模板',
  'features.attachments.filenamePatternDesc':
    '支持 {note}、{suffix}、{timestamp}。粘贴图片时 {suffix} 是毫秒时间戳，{timestamp} 是本地时间 YYYYMMDD-HHmmss。扩展名会自动追加。',
  'features.attachments.uploadFilenamePattern': '上传文件名模板',
  'features.attachments.uploadFilenamePatternDesc':
    '上传文件时使用。{suffix} 是原文件名（清洗后，不含扩展名）；默认只保留原文件名，不添加笔记前缀。扩展名会自动追加。',
  'features.attachments.embedImages': '图片使用嵌入',
  'features.attachments.embedImagesDesc':
    '图片插入为嵌入（![[...]] 或 ![...](...)）；关闭后插入普通链接。',
  'features.attachments.command.upload': '上传附件并插入链接',

  'features.attachments.notice.noActiveNote':
    '请先打开一个已保存的 Markdown 笔记，再粘贴附件。',
  'features.attachments.notice.noActiveEditor':
    '请切换到 Markdown 编辑模式后再上传附件。',
  'features.attachments.notice.busy':
    '请先完成当前附件的命名，再开始下一个附件操作。',
  'features.attachments.notice.cancelled': '已取消粘贴附件。',
  'features.attachments.notice.invalidSettings': '附件设置无效：{message}',
  'features.attachments.notice.saveFailed': '保存附件失败：{message}',
  'features.attachments.notice.linkFailed':
    '附件已保存，但插入链接失败：{message}。请手动插入链接。',
  'features.attachments.notice.uploadFailed': '上传附件失败：{message}',
  'features.attachments.notice.noFiles': '没有选择文件。',

  'features.attachments.rename.title': '保存附件',
  'features.attachments.rename.position': '第 {index} / {total} 张图片',
  'features.attachments.rename.folder': '保存到：{folder}',
  'features.attachments.rename.label': '文件名',
  'features.attachments.rename.save': '保存',
  'features.attachments.rename.errorEmpty': '请输入文件名。',
  'features.attachments.rename.errorSeparator': '文件名不能包含 / 或 \\。',
  'features.attachments.rename.errorInvalid': '文件名包含不允许的字符。',
  'features.attachments.rename.errorTooLong': '文件名过长。',
  'features.attachments.rename.errorReserved': '该名称被操作系统保留。',
  'features.attachments.rename.errorExists': '同名文件或文件夹已存在。',
  'features.attachments.rename.errorDuplicate':
    '该名称已被本次粘贴中的另一个附件使用。',

  'features.attachments.validation.assetsRootEmpty':
    '附件根目录不能为空。',
  'features.attachments.validation.assetsRootAbsolute':
    '请输入 Vault 相对路径，不要使用绝对路径或盘符路径。',
  'features.attachments.validation.assetsRootInvalid':
    '附件根目录不能包含“.”或“..”路径段。',
  'features.attachments.validation.patternEmpty': '文件名模板不能为空。',
  'features.attachments.validation.patternSeparator':
    '文件名模板不能包含 / 或 \\。',
  'features.attachments.validation.patternToken':
    '文件名模板包含未知 token。允许的 token：{note}、{suffix}、{timestamp}。',
  'features.attachments.validation.patternInvalid':
    '文件名模板没有生成可用的文件名。',

  'features.note-roaming.name': '笔记漫游',
  'features.note-roaming.description':
    '从指定路径中随机打开一篇 Markdown 笔记；未配置路径时漫游整个 Vault。',
  'features.note-roaming.roamPaths': '漫游路径',
  'features.note-roaming.roamPathsDesc':
    '每行一个 Vault 相对文件夹或 Markdown 文件路径；文件夹包含其所有子目录。留空表示整个 Vault。',
  'features.note-roaming.roamPathsPlaceholder':
    '例如：daily-notes / projects/archive',
  'features.note-roaming.command.roam': '漫游到随机笔记',
  'features.note-roaming.ribbon': '漫游到随机笔记',
  'features.note-roaming.validation.pathInvalid':
    '无效的漫游路径：{path}。请输入 Vault 相对路径，且不能包含“.”或“..”路径段。',
  'features.note-roaming.notice.noNotes':
    '没有可漫游的 Markdown 笔记，请检查漫游路径。',
  'features.note-roaming.notice.openFailed':
    '打开随机笔记失败：{message}',

  'features.slides.name': 'Markdown 演示',
  'features.slides.description':
    '按标题层级把当前笔记转换为全屏演示页：H1 为主题页，H2 为正文页，无需添加分隔线。',
  'features.slides.showBreadcrumb': '显示正文页页眉',
  'features.slides.showBreadcrumbDesc':
    '默认关闭；打开后在正文页顶部显示“一级菜单-二级菜单”。',
  'features.slides.breadcrumbSeparator': '页眉分隔符',
  'features.slides.breadcrumbSeparatorDesc':
    '连接一级和二级标题，默认“-”；最多 3 个字符。',
  'features.slides.showPageNumber': '显示页码',
  'features.slides.showProgress': '显示进度条',
  'features.slides.autoFit': '自动缩放内容',
  'features.slides.autoFitDesc':
    '内容超出页面时自动缩小字号，最低 50%；关闭后改为页内滚动。',
  'features.slides.colorScheme': '配色',
  'features.slides.colorSchemeDesc':
    '跟随 Obsidian 主题，或强制浅色/深色画布。',
  'features.slides.transition': '翻页动画',
  'features.slides.transitionNone': '无',
  'features.slides.transitionFade': '淡入',
  'features.slides.colorVault': '跟随主题',
  'features.slides.colorLight': '浅色',
  'features.slides.colorDark': '深色',
  'features.slides.command.present': '演示当前笔记',
  'features.slides.ribbon': '演示当前笔记',
  'features.slides.menu.present': '演示此笔记',
  'features.slides.notice.noActiveNote':
    '请先打开一篇 Markdown 笔记，再开始演示。',
  'features.slides.notice.emptyNote': '这篇笔记没有可演示的内容。',
  'features.slides.notice.loading': '正在准备演示…',
  'features.slides.notice.renderFailed': '演示渲染失败：{message}',
  'features.slides.validation.separatorEmpty': '页眉分隔符不能为空。',
  'features.slides.validation.separatorTooLong': '页眉分隔符最多 3 个字符。',
  'features.slides.aria.previous': '上一页',
  'features.slides.aria.next': '下一页',
};
