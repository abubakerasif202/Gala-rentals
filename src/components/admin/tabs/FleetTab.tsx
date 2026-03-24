import React from 'react';
import { motion } from 'motion/react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { Car } from '../../../types';
import { UseMutationResult } from '@tanstack/react-query';

interface FleetTabProps {
  cars: Car[];
  setIsAddingCar: (val: boolean) => void;
  setEditingCar: (car: Car) => void;
  deleteCarMutation: UseMutationResult<any, Error, number, unknown>;
}

export default function FleetTab({
  cars,
  setIsAddingCar,
  setEditingCar,
  deleteCarMutation,
}: FleetTabProps) {
  return (
    <motion.div
      key="cars"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-12"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-4xl font-bold text-white uppercase tracking-tighter mb-2">
            Fleet <span className="text-brand-gold italic">Management</span>
          </h2>
          <p className="text-brand-grey font-light">
            Control and update your vehicle inventory.
          </p>
        </div>
        <button
          onClick={() => setIsAddingCar(true)}
          className="flex w-full items-center justify-center gap-3 bg-brand-gold px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-brand-navy shadow-lg transition-all hover:bg-brand-gold-light md:w-auto"
        >
          <Plus className="w-4 h-4" /> Add New Vehicle
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {cars.map((car) => (
          <div
            key={car.id}
            className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden group hover:border-brand-gold/30 transition-all duration-500"
          >
            <div className="aspect-video relative overflow-hidden">
              <img
                src={car.image}
                alt={car.name}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
              />
              <div className="absolute top-4 right-4 flex gap-2">
                <span
                  className={`px-4 py-1.5 rounded-full text-[8px] font-bold uppercase tracking-widest backdrop-blur-md border ${
                    car.status === 'Available'
                      ? 'bg-green-500/20 text-green-400 border-green-500/30'
                      : 'bg-brand-navy/60 text-brand-grey border-white/10'
                  }`}
                >
                  {car.status}
                </span>
              </div>
            </div>
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white group-hover:text-brand-gold transition-colors">
                    {car.name}
                  </h3>
                  <div className="text-xs text-brand-grey mt-1 font-light">
                    {car.model_year} Model
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-brand-grey uppercase tracking-widest mb-1">
                    Weekly
                  </div>
                  <div className="text-sm font-bold text-white">
                    ${car.weekly_price}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-6 border-t border-white/5">
                <button
                  onClick={() => setEditingCar(car)}
                  className="flex-1 py-3 bg-white/5 border border-white/10 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-brand-gold hover:text-brand-navy hover:border-brand-gold transition-all"
                >
                  <Edit2 className="w-3.5 h-3.5 mx-auto" />
                </button>
                <button
                  onClick={() => {
                    if (
                      window.confirm('Are you sure you want to delete this vehicle?')
                    ) {
                      deleteCarMutation.mutate(car.id);
                    }
                  }}
                  className="flex-1 py-3 bg-white/5 border border-white/10 text-red-500 text-[10px] font-bold uppercase tracking-widest hover:bg-red-500 hover:text-white hover:border-red-500 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5 mx-auto" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
