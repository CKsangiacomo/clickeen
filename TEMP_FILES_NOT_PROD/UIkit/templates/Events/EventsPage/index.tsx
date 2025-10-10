"use client";

import Layout from "@/components/Layout";
import Breadcrumbs from "@/components/Breadcrumbs";
import Button from "@/components/Button";
import Cards from "@/components/Cards";
import TopSellingEvents from "./TopSellingEvents";
import RecentEventSubmissions from "./RecentEventSubmissions";

import { stats } from "./stats";

const EventsPage = () => {
    return (
        <Layout title="Events">
            <Breadcrumbs items={["Management", "Events"]}>
                <Button className="max-md:w-full" isSecondary isMedium>
                    Export CSV
                </Button>
            </Breadcrumbs>
            <div className="flex gap-6 mb-6 max-md:flex-col">
                <Cards
                    className="shrink-0 w-100 !mt-0 max-4xl:w-75 max-2xl:w-64 max-lg:w-56 max-md:w-full"
                    items={stats}
                    isColumn
                />
                <TopSellingEvents />
            </div>
            <RecentEventSubmissions />
        </Layout>
    );
};

export default EventsPage;
