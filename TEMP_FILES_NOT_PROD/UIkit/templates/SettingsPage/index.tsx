"use client";

import { useState } from "react";
import Layout from "@/components/Layout";
import Breadcrumbs from "@/components/Breadcrumbs";
import Button from "@/components/Button";
import General from "./General";
import PlanAndPricing from "./PlanAndPricing";
import MyAccount from "./MyAccount";
import PaymentAndBilling from "./PaymentAndBilling";
import TaxAndDuties from "./TaxAndDuties";
import LinkAccount from "./LinkAccount";
import TimeAndLanguage from "./TimeAndLanguage";
import Password from "./Password";
import Notifications from "./Notifications";

import { navigation } from "./navigation";

const SettingsPage = () => {
    const [activeId, setActiveId] = useState(0);

    return (
        <Layout title="Settings">
            <Breadcrumbs
                className="max-md:hidden"
                items={["Other", "Settings"]}
            >
                <div className="flex gap-3">
                    <Button className="min-w-30" isSecondary isMedium>
                        Cancel
                    </Button>
                    <Button className="min-w-30" isPrimary isMedium>
                        Save Change
                    </Button>
                </div>
            </Breadcrumbs>
            <div className="flex border border-gray-100 rounded-2xl max-md:relative max-md:flex-col max-md:border-0 max-md:rounded-none max-md:min-h-[calc(100svh-5.6rem)] max-md:-mt-6 max-md:-mx-6">
                <div className="flex flex-col gap-3 shrink-0 w-75 p-4 border-r border-gray-100 max-4xl:w-50 max-2xl:w-45 max-md:flex-row max-md:w-auto max-md:overflow-x-auto max-md:scrollbar-none max-md:border-b max-md:border-gray-100">
                    {navigation.map((item) => (
                        <button
                            className={`flex items-center h-9.25 px-3 border rounded-lg text-body-md transition-all hover:text-gray-900 max-md:shrink-0 ${
                                activeId === item.id
                                    ? "border-gray-100 bg-gray-25 font-semibold text-gray-900"
                                    : "border-transparent font-medium text-gray-500"
                            }`}
                            key={item.id}
                            onClick={() => setActiveId(item.id)}
                        >
                            {item.title}
                        </button>
                    ))}
                </div>
                <div className="grow">
                    {activeId === 0 && <General />}
                    {activeId === 1 && <PlanAndPricing />}
                    {activeId === 2 && <MyAccount />}
                    {activeId === 3 && <PaymentAndBilling />}
                    {activeId === 4 && <TaxAndDuties />}
                    {activeId === 5 && <LinkAccount />}
                    {activeId === 6 && <TimeAndLanguage />}
                    {activeId === 7 && <Password />}
                    {activeId === 8 && <Notifications />}
                </div>
                <div className="hidden gap-4 border-t border-gray-100 pt-6 px-6 max-md:flex">
                    <Button className="flex-1" isSecondary isMedium>
                        Cancel
                    </Button>
                    <Button className="flex-1" isPrimary isMedium>
                        Save Change
                    </Button>
                </div>
            </div>
        </Layout>
    );
};

export default SettingsPage;
