// Renders a local HTML or SVG file, or a page at an http(s) address, to a PNG
// with WebKit: swift scripts/render.swift <file or URL> <width> <height> <out.png> [scale]
// The page is laid out at width × height; the PNG has that many pixels times
// `scale` (default 1). Used by scripts/make-images.sh (macOS only). Scripts
// in the page run, so og.html can draw its canvas before the snapshot; a
// page that needs longer keeps `data-rendering` on <html> until it is done.
// What the page leaves in `data-rect` on <html> is printed: the part of the
// picture it wants cut out, for the caller.
import AppKit
import WebKit

let args = CommandLine.arguments
guard args.count == 5 || args.count == 6, let width = Double(args[2]), let height = Double(args[3]),
      let scale = args.count == 6 ? Double(args[5]) : 1 else {
    FileHandle.standardError.write("usage: render.swift <file or URL> <width> <height> <out.png> [scale]\n".data(using: .utf8)!)
    exit(1)
}
// The view has the output's size and zooms the page, so the result does not depend on the screen.
let (w, h) = (width * scale, height * scale)
let out = URL(fileURLWithPath: args[4])

final class Loader: NSObject, WKNavigationDelegate {
    let w: Double, h: Double, out: URL
    init(w: Double, h: Double, out: URL) { self.w = w; self.h = h; self.out = out }

    func webView(_ view: WKWebView, didFinish _: WKNavigation!) {
        // Give fonts, images and canvas drawing a moment to settle.
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { self.whenRendered(view) }
    }

    /// Take the snapshot once the page no longer says it is rendering.
    func whenRendered(_ view: WKWebView) {
        view.evaluateJavaScript("document.documentElement.hasAttribute('data-rendering')") { busy, _ in
            if busy as? Bool == true {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { self.whenRendered(view) }
            } else {
                self.snapshot(view)
            }
        }
    }

    func snapshot(_ view: WKWebView) {
        // A view that is not on screen does not run CSS animations: put entrances at their end.
        let (w, h, out) = (self.w, self.h, self.out)
        view.evaluateJavaScript("for (const a of document.getAnimations()) { try { a.finish() } catch {} }")
        let config = WKSnapshotConfiguration()
        config.rect = NSRect(x: 0, y: 0, width: w, height: h)
        view.takeSnapshot(with: config) { image, error in
            guard let image, let tiff = image.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff) else {
                FileHandle.standardError.write("snapshot failed: \(String(describing: error))\n".data(using: .utf8)!)
                exit(1)
            }
            // The snapshot is at screen scale; scale it to the exact size asked for.
            let target = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: Int(w), pixelsHigh: Int(h), bitsPerSample: 8,
                                          samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
                                          bytesPerRow: 0, bitsPerPixel: 0)!
            NSGraphicsContext.saveGraphicsState()
            NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: target)
            NSGraphicsContext.current?.imageInterpolation = .high
            rep.draw(in: NSRect(x: 0, y: 0, width: w, height: h))
            NSGraphicsContext.restoreGraphicsState()
            try! target.representation(using: .png, properties: [:])!.write(to: out)
            view.evaluateJavaScript("document.documentElement.dataset.rect ?? ''") { rect, _ in
                print(rect as? String ?? "")
                exit(0)
            }
        }
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.prohibited)
let view = WKWebView(frame: NSRect(x: 0, y: 0, width: w, height: h))
view.setValue(false, forKey: "drawsBackground")
view.pageZoom = scale
let window = NSWindow(contentRect: view.frame, styleMask: [.borderless], backing: .buffered, defer: false)
window.contentView = view
let loader = Loader(w: w, h: h, out: out)
view.navigationDelegate = loader
if args[1].hasPrefix("http://") || args[1].hasPrefix("https://"), let url = URL(string: args[1]) {
    view.load(URLRequest(url: url))
} else {
    let file = URL(fileURLWithPath: args[1]).standardizedFileURL
    view.loadFileURL(file, allowingReadAccessTo: file.deletingLastPathComponent().deletingLastPathComponent())
}
DispatchQueue.main.asyncAfter(deadline: .now() + 40) { FileHandle.standardError.write("timeout\n".data(using: .utf8)!); exit(2) }
app.run()
