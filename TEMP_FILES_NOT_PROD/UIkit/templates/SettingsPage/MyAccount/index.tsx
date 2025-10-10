import { useState } from "react";
import Field from "@/components/Field";
import Item from "../Item";

const MyAccount = ({}) => {
    const [fullName, setFullName] = useState("");
    const [emailAddress, setEmailAddress] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");

    return (
        <Item
            title="Account Details"
            description="View and update your account details, profile, and more."
        >
            <div className="flex flex-col gap-4">
                <Field
                    label="Full Name"
                    placeholder="Enter full name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                />
                <Field
                    label="Email Address"
                    placeholder="Enter email address"
                    type="email"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    required
                />
                <Field
                    label="Phone Number (optional)"
                    placeholder="Enter phone number"
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                />
            </div>
        </Item>
    );
};

export default MyAccount;
