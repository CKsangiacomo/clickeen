import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

type LayoutProps = {
    title: string;
    children: React.ReactNode;
};

const Layout = ({ title, children }: LayoutProps) => {
    const [toggle, setToggle] = useState(false);
    const [visibleSidebar, setVisibleSidebar] = useState(false);

    return (
        <div
            className={`pt-18 max-md:pt-16.25 ${
                toggle ? "pl-18" : "pl-69 max-xl:pl-0"
            }`}
        >
            <Sidebar
                toggle={toggle}
                visible={visibleSidebar}
                onToggle={() => setToggle(!toggle)}
                onClose={() => setVisibleSidebar(false)}
            />
            <Header
                title={title}
                toggle={toggle}
                onShow={() => setVisibleSidebar(true)}
            />
            <div
                className={`hidden fixed inset-0 z-25 bg-gray-900/50 backdrop-blur-[0.125rem] transition-all duration-300 max-xl:block ${
                    visibleSidebar
                        ? "visible opacity-100"
                        : "invisible opacity-0"
                }`}
                onClick={() => {
                    setVisibleSidebar(false);
                }}
            ></div>
            <div className="px-8 py-6 max-md:px-6">{children}</div>
        </div>
    );
};

export default Layout;
