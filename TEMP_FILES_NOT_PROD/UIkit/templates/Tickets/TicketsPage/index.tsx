"use client";

import { useState } from "react";
import Layout from "@/components/Layout";
import Breadcrumbs from "@/components/Breadcrumbs";
import Button from "@/components/Button";
import Cards from "@/components/Cards";
import Modal from "@/components/Modal";
import NewTicket from "./NewTicket";
import TicketsTable from "./TicketsTable";

import { stats } from "./stats";

const TicketsPage = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <>
            <Layout title="Tickets">
                <Breadcrumbs items={["Management", "Tickets"]}>
                    <Button
                        isPrimary
                        isMedium
                        onClick={() => setIsModalOpen(true)}
                    >
                        Create New Ticket
                    </Button>
                </Breadcrumbs>
                <Cards items={stats} />
                <TicketsTable />
            </Layout>
            <Modal
                title="New Ticket"
                open={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                isSlidePanel
                contentFooter={
                    <Button className="min-w-30" isPrimary isMedium>
                        Create
                    </Button>
                }
            >
                <NewTicket />
            </Modal>
        </>
    );
};

export default TicketsPage;
