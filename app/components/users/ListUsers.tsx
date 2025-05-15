"use client";

import { useState } from "react";
import CreateUserModal from "./CreateUserModal";
import TableUsers from "./TableUsers";

export default function ListUsers() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  return (
    <div>
      <div className="flex justify-between mb-4">
        <div></div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          Crear usuario
        </button>
      </div>

      <TableUsers />
      
      <CreateUserModal 
        isOpen={isCreateModalOpen}
        setIsOpen={setIsCreateModalOpen}
      />
    </div>
  );
}
