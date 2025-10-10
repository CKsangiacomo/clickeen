import { useState } from "react";
import Field from "@/components/Field";
import Item from "../Item";
import Payment from "./Payment";
import Plan from "./Plan";

const PaymentAndBilling = ({}) => {
    const [emailAddress, setEmailAddress] = useState("");

    return (
        <>
            <Item
                title="Payment"
                description="Manage your payment methods securely. Add, update, or remove your credit/debit cards."
            >
                <Payment />
            </Item>
            <Item
                title="Billing"
                description="Review and update your billing information to ensure accurate and timely payments."
            >
                <Plan />
            </Item>
            <Item
                title="Email address"
                description="Invoice will be sent to this email address."
            >
                <Field
                    label="Email Address"
                    placeholder="Enter email address"
                    type="email"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    required
                />
            </Item>
        </>
    );
};

export default PaymentAndBilling;
