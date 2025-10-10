import Button from "@/components/Button";

import { invoices } from "./invoices";

const Plan = ({}) => (
    <div className="">
        <div className="flex flex-wrap gap-2 mb-4 max-md:gap-0">
            <div className="grow max-md:w-full max-md:mb-4">
                <div className="font-semibold">Billing Period</div>
                <div className="mt-1 font-medium text-gray-500">
                    Next billing on March 18, 2025
                </div>
            </div>
            <Button className="shrink-0 max-md:grow" isSecondary isMedium>
                Change Billing Period
            </Button>
            <Button
                className="shrink-0 [&_svg]:fill-gray-900 max-md:ml-2"
                isSecondary
                isMedium
                isSquare
                icon="bell"
            />
        </div>
        <div className="border border-gray-100 rounded-2xl">
            <div className="p-4">
                <div className="flex justify-between items-center mb-2">
                    <div className="text-body-lg font-semibold">Basic Plan</div>
                    <Button isSecondary isSmall>
                        Downgrade
                    </Button>
                </div>
                <div className="font-medium text-gray-500">
                    <span className="text-h4 text-gray-900">$29</span> / month
                </div>
                <div className="mt-1 font-medium text-gray-500">
                    All the basics for starting a new business
                </div>
            </div>
            <div className="flex justify-between items-center p-4 border-t border-gray-100">
                <button className="text-body-sm font-semibold text-error-100 transition-colors hover:text-error-200">
                    Change Plan
                </button>
                <Button isSecondary isSmall>
                    Change Plan
                </Button>
            </div>
        </div>
        <div className="mt-4 border border-gray-100 rounded-2xl overflow-hidden max-md:overflow-x-auto max-md:scrollbar-none">
            <table className="w-full [&_th,&_td]:pl-3 [&_th,&_td]:last:w-14 [&_th,&_td]:last:px-3 max-md:w-117">
                <thead>
                    <tr className="[&_th]:py-2.5 [&_th]:bg-gray-25 [&_th]:text-left [&_th]:text-body-sm [&_th]:font-medium [&_th]:text-gray-500">
                        <th>Invoice #</th>
                        <th>Date</th>
                        <th>Plan</th>
                        <th>Amount</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {invoices.map((invoice) => (
                        <tr
                            className="[&_td]:py-3 [&_td]:border-t [&_td]:border-gray-100 [&_td]:font-medium [&_td]:text-gray-900"
                            key={invoice.id}
                        >
                            <td>#{invoice.id}</td>
                            <td>{invoice.date}</td>
                            <td>{invoice.plan}</td>
                            <td>${invoice.amount}</td>
                            <td>
                                <Button
                                    className="[&_svg]:fill-gray-900"
                                    isSecondary
                                    isSmall
                                    isSquare
                                    icon="download"
                                />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);

export default Plan;
