// Routes under /capture get this layout — points to the capture-specific
// PWA manifest so when the user installs from /capture they get a
// separate app on their home screen (vs. installing the full Align app).

export const metadata = {
  title: 'Align Capture',
  description: 'Quick capture for Align.',
  manifest: '/manifest-capture.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Capture',
  },
};

export default function CaptureLayout({ children }) {
  return children;
}
