import { useState } from "react";
import Field from "@/components/Field";
import Select from "@/components/Select";
import { SelectOption } from "@/types/select";

const paymentMethods = [
    { id: 0, name: "PayPal" },
    { id: 1, name: "Bank" },
    { id: 2, name: "Payoneer" },
];

const PayoutRequest = ({}) => {
    const [amount, setAmount] = useState("");
    const [bankDetails, setBankDetails] = useState("");
    const [note, setNote] = useState("");
    const [paymentMethod, setPaymentMethod] = useState<SelectOption>(
        paymentMethods[0]
    );

    return (
        <div className="flex flex-col gap-4">
            <Field
                label="Amount to Withdraw"
                placeholder="Enter amount"
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
            />
            <Select
                label="Payment Method"
                value={paymentMethod}
                onChange={setPaymentMethod}
                options={paymentMethods}
                required
            />
            <Field
                label="Bank/PayPal Details"
                placeholder="Enter details"
                type="text"
                value={bankDetails}
                onChange={(e) => setBankDetails(e.target.value)}
                required
            />
            <Field
                label="Note (optional)"
                placeholder="Enter note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                required
                textarea
            />
        </div>
    );
};

export default PayoutRequest;
