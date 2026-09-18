// Markdown files under chainbuddy/knowledge/ are bundled as text (see the
// asset/source rule in craco.config.js).
declare module "*.md" {
  const content: string;
  export default content;
}
