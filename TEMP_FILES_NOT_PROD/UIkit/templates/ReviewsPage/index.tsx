"use client";

import Layout from "@/components/Layout";
import Breadcrumbs from "@/components/Breadcrumbs";
import Button from "@/components/Button";
import Cards from "@/components/Cards";
import ReviewsTable from "./ReviewsTable";

import { stats } from "./stats";

const ReviewsPage = () => {
    return (
        <Layout title="Reviews">
            <Breadcrumbs items={["Management", "Reviews"]}>
                <Button className="max-md:w-full" isSecondary isMedium>
                    Export CSV
                </Button>
            </Breadcrumbs>
            <Cards items={stats} />
            <ReviewsTable />
        </Layout>
    );
};

export default ReviewsPage;
