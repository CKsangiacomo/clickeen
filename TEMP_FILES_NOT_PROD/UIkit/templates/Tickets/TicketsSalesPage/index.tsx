"use client";

import Layout from "@/components/Layout";
import Breadcrumbs from "@/components/Breadcrumbs";
import Button from "@/components/Button";
import Cards from "@/components/Cards";
import AttendeeListTable from "./AttendeeListTable";

import { stats } from "./stats";

const TicketsSalesPage = () => {
    return (
        <Layout title="Tickets Sales">
            <Breadcrumbs items={["Management", "Tickets"]}>
                <Button className="max-md:w-full" isSecondary isMedium>
                    Export CSV
                </Button>
            </Breadcrumbs>
            <Cards items={stats} />
            <AttendeeListTable />
        </Layout>
    );
};

export default TicketsSalesPage;
