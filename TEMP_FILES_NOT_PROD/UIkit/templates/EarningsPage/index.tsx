"use client";

import { useState } from "react";
import Layout from "@/components/Layout";
import Breadcrumbs from "@/components/Breadcrumbs";
import Button from "@/components/Button";
import Cards from "@/components/Cards";
import Modal from "@/components/Modal";
import EarningsTable from "./EarningsTable";
import PayoutRequest from "./PayoutRequest";

import { stats } from "./stats";

const EarningsPage = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <>
            <Layout title="Earnings">
                <Breadcrumbs items={["Management", "Earnings"]}>
                    <Button
                        className="max-md:w-full"
                        isPrimary
                        isMedium
                        onClick={() => setIsModalOpen(true)}
                    >
                        Request Payout
                    </Button>
                </Breadcrumbs>
                <Cards items={stats} />
                <EarningsTable />
            </Layout>
            <Modal
                title="Payout Request"
                open={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                isSlidePanel
                contentFooter={
                    <Button className="min-w-30" isPrimary isMedium>
                        Submit
                    </Button>
                }
            >
                <PayoutRequest />
            </Modal>
        </>
    );
};

export default EarningsPage;
