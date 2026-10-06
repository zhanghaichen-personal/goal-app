import "./globals.css";

export const metadata = {
  title: "Goal Matrix",
  description: "Goals and dynamic Eisenhower matrix",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
