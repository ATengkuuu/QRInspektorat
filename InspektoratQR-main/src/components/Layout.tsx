interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <main className="app-main">
      <div className="app-content">
        {children}
      </div>
    </main>
  );
};

export default Layout;
