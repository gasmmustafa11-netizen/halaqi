import React, { useEffect, useState } from 'react';
import { ArrowLeft, Search, Scissors, User, MapPin, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';

interface SearchViewProps {
  onNavigate: (view: string) => void;
}

interface SearchSalon {
  id: string;
  name: string;
  city?: string;
  image?: string;
  status?: string;
}

interface SearchUser {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
}

export const SearchView: React.FC<SearchViewProps> = ({ onNavigate }) => {
  const { isRtl } = useLanguage();

  const [query, setQuery] = useState('');
  const [salons, setSalons] = useState<SearchSalon[]>([]);
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const q = query.trim();

    if (!q) {
      setSalons([]);
      setUsers([]);
      setSearched(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setSearched(true);

      try {
        const result = await api.search(q);

        setSalons(Array.isArray(result?.salons) ? result.salons : []);
        setUsers(Array.isArray(result?.users) ? result.users : []);
      } catch (error) {
        console.error('[SEARCH VIEW]', error);
        setSalons([]);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <main
      className="min-h-[calc(100vh-64px)] bg-[#141414] text-white px-4 py-5 sm:px-6 lg:px-8"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => onNavigate('explore')}
            className="w-10 h-10 rounded-xl bg-[#262626] border border-[#333] flex items-center justify-center text-gray-300 hover:text-white hover:bg-[#333] transition-all"
            aria-label={isRtl ? 'رجوع' : 'Back'}
          >
            <ArrowLeft className={`w-5 h-5 ${isRtl ? 'rotate-180' : ''}`} />
          </button>

          <div>
            <h1 className="text-xl font-black text-white">
              {isRtl ? 'البحث' : 'Search'}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {isRtl
                ? 'ابحث عن صالون أو مستخدم'
                : 'Find a salon or user'}
            </p>
          </div>
        </div>

        {/* Search input */}
        <div className="relative mb-7">
          <div className="flex items-center bg-[#262626] border border-[#333] focus-within:border-[#D4AF37] rounded-2xl px-4 h-14 transition-all shadow-lg">
            <Search className="w-5 h-5 text-[#D4AF37] shrink-0" />

            <input
              autoFocus
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                isRtl
                  ? 'ابحث عن اسم صالون أو مستخدم...'
                  : 'Search for a salon or user...'
              }
              className="bg-transparent outline-none border-none w-full px-3 text-sm text-white placeholder-gray-500"
            />

            {loading && (
              <Loader2 className="w-5 h-5 text-[#D4AF37] animate-spin shrink-0" />
            )}
          </div>
        </div>

        {/* Empty state */}
        {!searched && (
          <div className="py-16 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-[#262626] border border-[#333] flex items-center justify-center mb-4">
              <Search className="w-7 h-7 text-[#D4AF37]" />
            </div>

            <h2 className="text-base font-bold text-gray-200">
              {isRtl ? 'ابدأ بالبحث' : 'Start searching'}
            </h2>

            <p className="text-xs text-gray-500 mt-2">
              {isRtl
                ? 'اكتب اسم الصالون أو المستخدم'
                : 'Type a salon or user name'}
            </p>
          </div>
        )}

        {/* Results */}
        {searched && !loading && (
          <div className="space-y-7">

            {/* Users */}
            {users.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-4 h-4 text-[#D4AF37]" />
                  <h2 className="font-black text-sm">
                    {isRtl ? 'المستخدمون' : 'Users'}
                  </h2>
                </div>

                <div className="space-y-2">
                  {users.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onNavigate(`user:${item.id}`)}
                      className="w-full flex items-center gap-3 p-3 rounded-2xl bg-[#1b1b1b] border border-[#2b2b2b] hover:border-[#D4AF37]/50 hover:bg-[#202020] transition-all text-start"
                    >
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-[#262626] border border-[#333] flex items-center justify-center shrink-0">
                        {item.avatar ? (
                          <img
                            src={item.avatar}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-5 h-5 text-[#D4AF37]" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm text-white truncate">
                          {item.name}
                        </p>
                        {item.email && (
                          <p className="text-[11px] text-gray-500 truncate" dir="ltr">
                            {item.email}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Salons */}
            {salons.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Scissors className="w-4 h-4 text-[#D4AF37]" />
                  <h2 className="font-black text-sm">
                    {isRtl ? 'الصالونات' : 'Salons'}
                  </h2>
                </div>

                <div className="space-y-2">
                  {salons.map((salon) => (
                    <button
                      key={salon.id}
                      type="button"
                      onClick={() => onNavigate(`salon:${salon.id}`)}
                      className="w-full flex items-center gap-3 p-3 rounded-2xl bg-[#1b1b1b] border border-[#2b2b2b] hover:border-[#D4AF37]/50 hover:bg-[#202020] transition-all text-start"
                    >
                      <div className="w-14 h-14 rounded-xl overflow-hidden bg-[#262626] border border-[#333] flex items-center justify-center shrink-0">
                        {salon.image ? (
                          <img
                            src={salon.image}
                            alt={salon.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Scissors className="w-6 h-6 text-[#D4AF37]" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm text-white truncate">
                          {salon.name}
                        </p>

                        {salon.city && (
                          <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {salon.city}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* No results */}
            {users.length === 0 && salons.length === 0 && (
              <div className="py-16 text-center">
                <Search className="w-8 h-8 text-gray-600 mx-auto mb-3" />

                <p className="text-sm font-bold text-gray-300">
                  {isRtl ? 'لم نجد نتائج' : 'No results found'}
                </p>

                <p className="text-xs text-gray-600 mt-2">
                  {isRtl
                    ? 'جرّب كتابة اسم مختلف'
                    : 'Try a different name'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
};
