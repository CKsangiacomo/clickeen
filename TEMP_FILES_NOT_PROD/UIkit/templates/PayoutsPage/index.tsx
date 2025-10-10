"use client";

import Layout from "@/components/Layout";
import Breadcrumbs from "@/components/Breadcrumbs";
import Button from "@/components/Button";
import Cards from "@/components/Cards";
import PayoutsTable from "./PayoutsTable";

import { stats } from "./stats";

const PayoutsPage = () => {
    return (
        <Layout title="Payouts">
            <Breadcrumbs items={["Home", "Payouts"]}>
                <Button className="max-md:w-full" isSecondary isMedium>
                    Export CSV
                </Button>
            </Breadcrumbs>
            <Cards items={stats} />
            <PayoutsTable />
        </Layout>
    );
};

export default PayoutsPage;
