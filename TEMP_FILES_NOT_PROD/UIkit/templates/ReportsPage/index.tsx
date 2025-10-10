"use client";

import Layout from "@/components/Layout";
import Breadcrumbs from "@/components/Breadcrumbs";
import Button from "@/components/Button";
import Cards from "@/components/Cards";
import RevenueAnalytics from "./RevenueAnalytics";
import RecentTransactions from "./RecentTransactions";

import { stats } from "./stats";

const HomePage = () => {
    return (
        <Layout title="Sales Reports">
            <Breadcrumbs items={["Home", "Sales Reports"]}>
                <Button className="max-md:w-full" isSecondary isMedium>
                    Export CSV
                </Button>
            </Breadcrumbs>
            <Cards items={stats} />
            <RevenueAnalytics />
            <RecentTransactions />
        </Layout>
    );
};

export default HomePage;
