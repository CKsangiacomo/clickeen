export type WidgetShellRenderArgs = {
  widgetType: string;
  rootClassName: string;
  sectionClassName: string;
  headerClassName: string;
  coreClassName: string;
  coreHtml: string;
};

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function renderWidgetShellHtml(args: WidgetShellRenderArgs): string {
  const widgetType = escapeAttribute(args.widgetType);
  return `<div class="stage" data-role="stage">
  <div class="pod" data-role="pod">
    <div class="ck-widget ${escapeAttribute(args.rootClassName)}" data-ck-widget="${widgetType}" data-role="root">
      <section class="${escapeAttribute(args.sectionClassName)} ck-headerLayout" data-role="${widgetType}">
        <header class="${escapeAttribute(args.headerClassName)} ck-header">
          <div class="ck-header__text">
            <h2 class="ck-header__title" data-role="header-title"></h2>
            <div class="ck-header__subtitle" data-role="header-subtitle" hidden></div>
          </div>
          <a class="ck-header__cta" data-role="header-cta" hidden></a>
        </header>
        <div class="${escapeAttribute(args.coreClassName)} ck-headerLayout__body">${args.coreHtml}</div>
      </section>
    </div>
  </div>
</div>`;
}
