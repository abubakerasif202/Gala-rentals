import React from 'react';
import { motion } from 'motion/react';
import { Archive, Edit2, Eye, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Car } from '../../../types';

interface FleetTabProps {
  cars: Car[];
  onAddVehicle: () => void;
  onArchiveVehicle: (car: Car) => void;
  onDeleteVehicle: (car: Car) => void;
  onEditVehicle: (car: Car) => void;
  onRestoreVehicle: (car: Car) => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const getStatusBadgeClasses = (car: Car) => {
  if (car.archived_at) {
    return 'bg-white/10 text-brand-grey border-white/10';
  }

  if (car.status === 'Available') {
    return 'bg-green-500/15 text-green-300 border-green-500/25';
  }

  if (car.status === 'Rented') {
    return 'bg-brand-gold/15 text-brand-gold border-brand-gold/30';
  }

  return 'bg-orange-500/15 text-orange-300 border-orange-500/25';
};

export default function FleetTab({
  cars,
  onAddVehicle,
  onArchiveVehicle,
  onDeleteVehicle,
  onEditVehicle,
  onRestoreVehicle,
}: FleetTabProps) {
  return (
    <motion.div
      key="cars"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="mb-2 text-4xl font-bold uppercase tracking-tighter text-white">
            Fleet <span className="italic text-brand-gold">Management</span>
          </h2>
          <p className="max-w-2xl text-sm font-light text-brand-grey">
            Add, update, archive, or remove vehicles without handling raw image URLs.
          </p>
        </div>
        <button
          onClick={onAddVehicle}
          className="flex w-full items-center justify-center gap-3 bg-brand-gold px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-brand-navy shadow-lg transition-all hover:bg-brand-gold-light lg:w-auto"
        >
          <Plus className="h-4 w-4" />
          Add Vehicle
        </button>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
        <div className="hidden grid-cols-[minmax(0,2.4fr)_140px_140px_140px_180px] gap-4 border-b border-white/10 px-6 py-4 text-[10px] font-bold uppercase tracking-[0.24em] text-brand-grey lg:grid">
          <span>Vehicle</span>
          <span>Status</span>
          <span>Weekly Rent</span>
          <span>Bond</span>
          <span className="text-right">Actions</span>
        </div>

        <div className="divide-y divide-white/10">
          {cars.map((car) => {
            const isArchived = Boolean(car.archived_at);

            return (
              <div
                key={car.id}
                className="grid gap-5 px-5 py-5 transition-colors hover:bg-white/[0.04] lg:grid-cols-[minmax(0,2.4fr)_140px_140px_140px_180px] lg:items-center lg:px-6"
              >
                <div className="flex items-center gap-4">
                  <div className="h-20 w-28 overflow-hidden rounded-2xl border border-white/10 bg-brand-navy/70">
                    <img src={car.image} alt={car.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-white">{car.name}</h3>
                      {isArchived && (
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.22em] text-brand-grey">
                          Archived
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs uppercase tracking-[0.22em] text-brand-grey">
                      {car.model_year} model
                    </p>
                    <a
                      href={car.image}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-brand-gold transition-colors hover:text-brand-gold-light"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View image
                    </a>
                  </div>
                </div>

                <div className="lg:text-center">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.24em] text-brand-grey lg:hidden">
                    Status
                  </div>
                  <span
                    className={`inline-flex rounded-full border px-4 py-2 text-[10px] font-bold uppercase tracking-[0.22em] ${getStatusBadgeClasses(
                      car
                    )}`}
                  >
                    {isArchived ? 'Archived' : car.status}
                  </span>
                </div>

                <div className="lg:text-center">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.24em] text-brand-grey lg:hidden">
                    Weekly Rent
                  </div>
                  <p className="text-sm font-semibold text-white">{formatCurrency(car.weekly_price)}</p>
                </div>

                <div className="lg:text-center">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.24em] text-brand-grey lg:hidden">
                    Bond
                  </div>
                  <p className="text-sm font-semibold text-white">{formatCurrency(car.bond)}</p>
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <button
                    onClick={() => onEditVehicle(car)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.22em] text-white transition-all hover:border-brand-gold hover:bg-brand-gold hover:text-brand-navy"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    Edit
                  </button>
                  {isArchived ? (
                    <>
                      <button
                        onClick={() => onRestoreVehicle(car)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.22em] text-brand-gold transition-all hover:border-brand-gold hover:bg-brand-gold/10"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Restore
                      </button>
                      <button
                        onClick={() => onDeleteVehicle(car)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.22em] text-red-300 transition-all hover:bg-red-500/20"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => onArchiveVehicle(car)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.22em] text-brand-grey transition-all hover:border-white/20 hover:bg-white/10 hover:text-white"
                    >
                      <Archive className="h-3.5 w-3.5" />
                      Archive
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {cars.length === 0 && (
            <div className="px-6 py-16 text-center">
              <p className="text-sm font-light text-brand-grey">No vehicles found yet.</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
