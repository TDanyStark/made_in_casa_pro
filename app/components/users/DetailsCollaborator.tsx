"use client";

import CheckboxChangeState from "../checkbox/CheckboxChangeState";
import AreaSelect from "./AreaSelect";

interface DetailsCollaboratorProps {
  user_id: number;
  is_internal: boolean;
  area_id: number;
  skills?: string[];
}

const DetailsCollaborator = ({
  user_id,
  is_internal,
  area_id,
  skills,
}: DetailsCollaboratorProps) => {
  console.log({
    user_id,
    is_internal,
    area_id,
    skills,
  });
  return (
    <div className="w-full">
      <CheckboxChangeState
        label="Colaborador interno"
        id="user-internal"
        initialChecked={is_internal}
        endpoint={`users/${user_id}`}
        fieldName="is_internal"
      />
      <AreaSelect
        initial_value={area_id}
        placeholder="Selecciona o crea un área"
        required={false}
        disabled={false}
        onChange={(value) => console.log(value)}
        onBlur={() => console.log("blur")}
        className="mt-4"
        user_id={user_id}
      />
    </div>
  );
};

export default DetailsCollaborator;
