import { useState } from "react";
import Field from "@/components/Field";
import Item from "../Item";

const Password = ({}) => {
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");

    return (
        <Item title="Password" description="Change or view your password">
            <div className="flex flex-col gap-4">
                <Field
                    label="Current Password"
                    placeholder="Enter current password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                />
                <Field
                    label="New Password"
                    placeholder="Enter new password"
                    note="Must be at least 8 characters"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                />
            </div>
        </Item>
    );
};

export default Password;
