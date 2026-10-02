/**
 * Hands the document <head> over from the pre-rendered HTML to React.
 *
 * Every tag the prerenderer writes carries `data-prerender`. Once React mounts,
 * react-helmet-async re-creates equivalent tags, so the static copies must go or
 * the live DOM would contain duplicate canonicals, descriptions and JSON-LD.
 *
 * The <title> is the exception: Helmet updates `document.title`, which edits the
 * FIRST <title> element in place. If that element is the pre-rendered one and we
 * delete it afterwards, the title ends up empty. So the title is adopted (its
 * marker is dropped) rather than removed.
 */
export function clearPrerenderedHead(doc: Document = document): void {
  doc.head.querySelectorAll('[data-prerender]').forEach((el) => {
    if (el.tagName === 'TITLE') el.removeAttribute('data-prerender');
    else el.remove();
  });
}
