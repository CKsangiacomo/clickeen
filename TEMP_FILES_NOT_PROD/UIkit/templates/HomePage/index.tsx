"use client";

import Layout from "@/components/Layout";
import Breadcrumbs from "@/components/Breadcrumbs";
import Button from "@/components/Button";
import Cards from "@/components/Cards";
import TicketSalesAnalytics from "./TicketSalesAnalytics";
import UserDistribution from "./UserDistribution";
import RecentPayoutRequest from "./RecentPayoutRequest";

import { stats } from "./stats";

const HomePage = () => {
    return (
        <Layout title="Dashboard">
            <Breadcrumbs items={["Home", "Dashboard"]}>
                <Button className="max-md:w-full" isSecondary isMedium>
                    Generate Reports
                </Button>
            </Breadcrumbs>
            <Cards items={stats} />
            <div className="flex gap-6 mt-6 max-lg:flex-col">
                <TicketSalesAnalytics />
                <UserDistribution />
            </div>
            <RecentPayoutRequest />
        </Layout>
    );
};

export default HomePage;
