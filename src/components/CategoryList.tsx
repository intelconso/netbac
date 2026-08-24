import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { cn } from '../lib/utils';
import { CategoryGroup } from '../lib/inventory';
import { Article } from '../types';

// Les articles groupés par catégorie, chaque catégorie repliable.
//
// Plat par construction — une catégorie n'a pas de sous-catégorie. C'est tout
// l'intérêt du classement par catégorie face à l'ancien classement par
// emplacement : pas de niveau intermédiaire à déplier, donc pas de branche qui
// s'ouvre sur du vide.
//
// Partagé par l'écran Inventaire et le catalogue : même regroupement, lignes
// d'article différentes (naviguer d'un côté, modifier de l'autre), d'où le
// `renderArticle` en paramètre.
interface Props {
  groups: CategoryGroup[];
  openKeys: Record<string, boolean>;
  onToggle: (key: string) => void;
  // Une recherche ou un filtre ouvre tout : masquer un résultat derrière une
  // section repliée reviendrait à dire qu'il n'existe pas.
  forceOpen?: boolean;
  renderArticle: (article: Article) => React.ReactNode;
}

// La clé de repli d'un groupe. « Sans catégorie » n'a pas d'id, d'où le repli.
export const groupKey = (group: CategoryGroup): string => group.id ?? 'none';

export default function CategoryList({ groups, openKeys, onToggle, forceOpen, renderArticle }: Props) {
  return (
    <>
      {groups.map((group) => {
        const key = groupKey(group);
        const open = forceOpen || !!openKeys[key];
        return (
          <View key={key} className="gap-2">
            <Pressable
              onPress={() => onToggle(key)}
              className="bg-white rounded-2xl border border-gray-100 flex-row items-center gap-3 p-4 active:bg-gray-50"
            >
              <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: group.color }} />
              <Text
                className={cn(
                  'flex-1 text-xs font-black uppercase tracking-wide',
                  group.id ? 'text-gray-900' : 'text-gray-400'
                )}
                numberOfLines={1}
              >
                {group.name}
              </Text>
              <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                {group.total}
              </Text>
              {open ? (
                <ChevronDown size={16} color="#D1D5DB" />
              ) : (
                <ChevronRight size={16} color="#D1D5DB" />
              )}
            </Pressable>

            {open && (
              <View className="gap-2 pl-3">
                {group.articles.map((article) => (
                  <View key={article.id}>{renderArticle(article)}</View>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </>
  );
}
