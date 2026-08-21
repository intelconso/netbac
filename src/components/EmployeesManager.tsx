import React, { useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { Check, Pencil, Plus, Trash2, User, X } from 'lucide-react-native';
import { useStore } from '../lib/store';
import { cn } from '../lib/utils';

// Paramètres → Équipe : la liste des personnes qui cochent les tâches.
// Ce n'est pas un système de comptes — l'app reste mono-compte par restaurant.
// C'est une liste de noms, pour signer une tâche d'un tap au lieu de la taper.
// Supprimer quelqu'un ne touche pas l'historique : chaque cochage a snapshotté
// son nom au moment où il a été fait.
export default function EmployeesManager() {
  const employees = useStore((s) => s.employees);
  const addEmployee = useStore((s) => s.addEmployee);
  const updateEmployee = useStore((s) => s.updateEmployee);
  const deleteEmployee = useStore((s) => s.deleteEmployee);
  const live = (employees ?? []).filter((e) => !e.deletedAt);

  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string; role: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  const handleAdd = () => {
    if (!name.trim()) return;
    addEmployee({ name, role });
    setName('');
    setRole('');
  };

  const saveEdit = () => {
    if (!editing || !editing.name.trim()) return;
    updateEmployee(editing.id, { name: editing.name, role: editing.role });
    setEditing(null);
  };

  return (
    <View className="gap-4">
      <View className="bg-white p-4 rounded-2xl border border-gray-100">
        <Text className="text-[11px] font-medium text-gray-500">
          Les personnes listées ici apparaissent au moment de cocher une tâche. Supprimer
          quelqu'un ne retire jamais son nom des tâches déjà faites.
        </Text>
      </View>

      <View className="gap-3">
        {live.map((e) => {
          const isEditing = editing?.id === e.id;
          return (
            <View key={e.id} className="bg-white p-3 rounded-2xl border border-gray-100 gap-3">
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center">
                  <Text className="text-xs font-black text-primary">{e.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-black text-gray-900 uppercase">{e.name}</Text>
                  {!!e.role && (
                    <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{e.role}</Text>
                  )}
                </View>
                {isEditing ? (
                  <>
                    <Pressable onPress={saveEdit} className="w-9 h-9 rounded-xl bg-primary/10 items-center justify-center">
                      <Check size={14} color="#10B981" />
                    </Pressable>
                    <Pressable onPress={() => setEditing(null)} className="w-9 h-9 rounded-xl bg-gray-50 items-center justify-center">
                      <X size={14} color="#9CA3AF" />
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Pressable
                      onPress={() => setEditing({ id: e.id, name: e.name, role: e.role ?? '' })}
                      className="w-9 h-9 rounded-xl bg-gray-50 items-center justify-center"
                    >
                      <Pencil size={14} color="#9CA3AF" />
                    </Pressable>
                    <Pressable
                      onPress={() => setConfirmDelete({ id: e.id, name: e.name })}
                      className="w-9 h-9 rounded-xl bg-red-50 items-center justify-center"
                    >
                      <Trash2 size={14} color="#EF4444" />
                    </Pressable>
                  </>
                )}
              </View>

              {isEditing && (
                <View className="gap-2">
                  <TextInput
                    value={editing.name}
                    onChangeText={(v) => setEditing({ ...editing, name: v })}
                    placeholder="Nom"
                    className="p-3 bg-gray-50 rounded-xl text-sm font-bold"
                  />
                  <TextInput
                    value={editing.role}
                    onChangeText={(v) => setEditing({ ...editing, role: v })}
                    placeholder="Poste (optionnel) — ex. Cuisine"
                    className="p-3 bg-gray-50 rounded-xl text-sm font-bold"
                  />
                </View>
              )}
            </View>
          );
        })}

        {live.length === 0 && (
          <View className="bg-white p-6 rounded-2xl border border-dashed border-gray-200 items-center gap-2">
            <User size={20} color="#D1D5DB" />
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">
              Aucun membre — ajoutez-en un
            </Text>
          </View>
        )}
      </View>

      {confirmDelete && (
        <View className="bg-white p-4 rounded-2xl border border-red-200 gap-3">
          <Text className="text-[10px] font-bold text-gray-600 uppercase">
            Retirer « {confirmDelete.name} » de l'équipe ? Les tâches déjà faites gardent son nom.
          </Text>
          <View className="flex-row gap-2">
            <Pressable onPress={() => setConfirmDelete(null)} className="flex-1 py-3">
              <Text className="text-[10px] font-black text-gray-400 uppercase text-center">Annuler</Text>
            </Pressable>
            <Pressable
              onPress={() => { deleteEmployee(confirmDelete.id); setConfirmDelete(null); }}
              className="flex-1 py-3 bg-danger rounded-xl"
            >
              <Text className="text-[10px] font-black uppercase text-center text-white">Retirer</Text>
            </Pressable>
          </View>
        </View>
      )}

      <View className="bg-white p-3 rounded-2xl border-2 border-primary/20 gap-3">
        <TextInput value={name} onChangeText={setName} placeholder="Nom" className="p-3 bg-gray-50 rounded-xl text-sm font-bold" />
        <TextInput value={role} onChangeText={setRole} placeholder="Poste (optionnel) — ex. Cuisine" className="p-3 bg-gray-50 rounded-xl text-sm font-bold" />
        <Pressable
          onPress={handleAdd}
          disabled={!name.trim()}
          className={cn('py-3 bg-primary rounded-xl flex-row items-center justify-center gap-2', !name.trim() && 'opacity-40')}
        >
          <Plus size={14} color="#fff" />
          <Text className="text-[10px] font-black text-white uppercase">Ajouter</Text>
        </Pressable>
      </View>
    </View>
  );
}
