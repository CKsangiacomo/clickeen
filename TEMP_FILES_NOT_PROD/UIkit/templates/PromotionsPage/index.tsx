"use client";

import { useState } from "react";
import Layout from "@/components/Layout";
import Breadcrumbs from "@/components/Breadcrumbs";
import Button from "@/components/Button";
import Cards from "@/components/Cards";
import Modal from "@/components/Modal";
import PromotionsTable from "./PromotionsTable";
import AddPromotion from "./AddPromotion";

import { stats } from "./stats";

const PromotionsPage = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <>
            <Layout title="Promotions">
                <Breadcrumbs items={["Management", "Promotions"]}>
                    <Button
                        className="max-md:w-full"
                        isPrimary
                        isMedium
                        onClick={() => setIsModalOpen(true)}
                    >
                        Add Promotion
                    </Button>
                </Breadcrumbs>
                <Cards items={stats} />
                <PromotionsTable />
            </Layout>
            <Modal
                title="Add Promotion"
                open={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                isSlidePanel
                contentFooter={
                    <Button className="min-w-30" isPrimary isMedium>
                        Submit
                    </Button>
                }
            >
                <AddPromotion />
            </Modal>
        </>
    );
};

export default PromotionsPage;
