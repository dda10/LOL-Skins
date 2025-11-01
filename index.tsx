import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

// --- Type Definitions ---
interface Champion {
    id: string;
    key: string;
    name: string;
    title: string;
    blurb: string;
}

interface Skin {
    id: string;
    num: number;
    name: string;
    chromas: boolean;
}

interface ChampionFull {
    id: string;
    key: string;
    name: string;
    skins: Skin[];
}

interface FavoriteSkin extends Skin {
    championId: string;
    championName: string;
}

interface SkinInfo {
    price: number;
    rarity: string;
}

// --- API URLs ---
const VERSIONS_URL = 'https://ddragon.leagueoflegends.com/api/versions.json';
const DDRAGON_BASE_URL = (version: string) => `https://ddragon.leagueoflegends.com/cdn/${version}`;
const CHAMPION_SUMMARY_URL = (version: string) => `${DDRAGON_BASE_URL(version)}/data/en_US/champion.json`;
const CHAMPION_DETAIL_URL = (version: string, championId: string) => `${DDRAGON_BASE_URL(version)}/data/en_US/champion/${championId}.json`;
const SKIN_IMAGE_URL = (championId: string, skinNum: number) => `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${championId}_${skinNum}.jpg`;
const CENTERED_SKIN_IMAGE_URL = (championId: string, skinNum: number) => `https://ddragon.leagueoflegends.com/cdn/img/champion/centered/${championId}_${skinNum}.jpg`;
const CHAMPION_ICON_URL = (version: string, championId: string) => `${DDRAGON_BASE_URL(version)}/img/champion/${championId}.png`;
const SKIN_PRICE_URL = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/skins.json';


// --- Rarity Badge Component ---
const RarityBadge: React.FC<{ rarity: string }> = ({ rarity }) => {
    if (!rarity || rarity === 'None') return null;

    const rarityColors: { [key: string]: string } = {
        'Mythic': '#c46cde',
        'Ultimate': '#f28a30',
        'Legendary': '#e69427',
        'Epic': '#8b48d2',
        'Default': '#50617b',
    };

    const style: React.CSSProperties = {
        backgroundColor: rarityColors[rarity] || '#50617b',
        color: 'white',
        padding: '2px 8px',
        borderRadius: '10px',
        fontSize: '0.75em',
        fontWeight: 'bold',
        marginLeft: '8px',
        textTransform: 'uppercase',
        display: 'inline-block',
        verticalAlign: 'middle',
    };

    return <span style={style}>{rarity}</span>;
};


// --- Skin Modal Component ---
const SkinModal: React.FC<{
    champion: Champion;
    onClose: () => void;
    favorites: FavoriteSkin[];
    onToggleFavorite: (skin: Skin, championInfo: { id: string, name: string }) => void;
    championDetailsCache: Map<string, ChampionFull>;
    skinInfo: Map<number, SkinInfo>;
    apiVersion: string;
}> = ({ champion, onClose, favorites, onToggleFavorite, championDetailsCache, skinInfo, apiVersion }) => {
    const [championDetails, setChampionDetails] = useState<ChampionFull | null>(null);
    const [currentSkinIndex, setCurrentSkinIndex] = useState(0);
    const [imagesLoading, setImagesLoading] = useState(true);

    useEffect(() => {
        const details = championDetailsCache.get(champion.id);
        if (details) {
            setChampionDetails(details);
            // Preload all skin images for a smoother carousel experience
            Promise.all(details.skins.map(skin => {
                return new Promise((resolve, reject) => {
                    const img = new Image();
                    img.src = SKIN_IMAGE_URL(champion.id, skin.num);
                    img.onload = resolve;
                    img.onerror = reject;
                });
            })).then(() => setImagesLoading(false));
        } else {
             // This case should be rare with pre-caching, but is a good fallback.
            fetch(CHAMPION_DETAIL_URL(apiVersion, champion.id))
                .then(res => res.json())
                .then(data => {
                    const fetchedDetails = data.data[champion.id];
                    setChampionDetails(fetchedDetails);
                });
        }
    }, [champion.id, championDetailsCache, apiVersion]);

    const handlePrev = () => {
        if (!championDetails) return;
        setCurrentSkinIndex((prev) => (prev - 1 + championDetails.skins.length) % championDetails.skins.length);
    };

    const handleNext = () => {
        if (!championDetails) return;
        setCurrentSkinIndex((prev) => (prev + 1) % championDetails.skins.length);
    };

    if (!championDetails) {
        return (
            <div style={styles.modalOverlay}>
                <div style={styles.modalContent}>Loading skins...</div>
            </div>
        );
    }

    const currentSkin = championDetails.skins[currentSkinIndex];
    const isFavorite = favorites.some(fav => fav.id === currentSkin.id);
    const skinDetails = skinInfo.get(parseInt(currentSkin.id));

    return (
        <div style={styles.modalOverlay} onClick={onClose}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <button style={styles.closeButton} onClick={onClose}>&times;</button>
                <div style={styles.carouselContainer}>
                    {imagesLoading && <div style={{color: 'white', fontSize: '1.2em'}}>Loading skin art...</div>}
                    <img
                        style={{...styles.carouselImage, visibility: imagesLoading ? 'hidden' : 'visible'}}
                        src={SKIN_IMAGE_URL(champion.id, currentSkin.num)}
                        alt={currentSkin.name}
                    />
                    <button style={{...styles.carouselButton, ...styles.carouselButtonPrev}} onClick={handlePrev}>&#10094;</button>
                    <button style={{...styles.carouselButton, ...styles.carouselButtonNext}} onClick={handleNext}>&#10095;</button>
                </div>
                <div style={styles.skinInfo}>
                    <h3>{currentSkin.name === 'default' ? champion.name : currentSkin.name}</h3>
                     <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '10px' }}>
                        {skinDetails && skinDetails.price > 0 && (
                            <span style={styles.rpPrice}>{skinDetails.price} RP</span>
                        )}
                        {skinDetails && <RarityBadge rarity={skinDetails.rarity} />}
                        <button onClick={() => onToggleFavorite(currentSkin, championDetails)} style={styles.favoriteButton}>
                            <i className={`fas fa-heart`} style={{ color: isFavorite ? 'red' : '#ccc' }}></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};


// --- Main App Component ---
const App = () => {
    const [latestVersion, setLatestVersion] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [champions, setChampions] = useState<Champion[]>([]);
    const [favorites, setFavorites] = useState<FavoriteSkin[]>(() => {
        try {
            const saved = localStorage.getItem('favoriteSkins');
            const initial = saved ? JSON.parse(saved) : [];
            return Array.isArray(initial) ? initial : [];
        } catch (e) {
            return [];
        }
    });
    const [selectedChampion, setSelectedChampion] = useState<Champion | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [championDetailsCache, setChampionDetailsCache] = useState<Map<string, ChampionFull>>(new Map());
    const [skinInfo, setSkinInfo] = useState<Map<number, SkinInfo>>(new Map());
    const [hoveredFavorite, setHoveredFavorite] = useState<FavoriteSkin | null>(null);


    useEffect(() => {
        // First, fetch the latest version
        fetch(VERSIONS_URL)
            .then(res => res.json())
            .then(versions => {
                setLatestVersion(versions[0]); // The first one is the latest
            })
            .catch(error => {
                console.error("Failed to fetch API versions:", error);
                setIsLoading(false); // Stop loading on error
            });
        
        // Fetch skin prices, which is version-independent
        fetch(SKIN_PRICE_URL)
            .then(res => {
                if (!res.ok) throw new Error(`Failed to fetch skin prices with status: ${res.status}`);
                return res.json();
            })
            .then(data => {
                const infoMap = new Map<number, SkinInfo>();
                for (const skinId in data) {
                    const skinData = data[skinId];
                    if (skinData.cost && (skinData.cost !== -1 || skinData.saleCost !== -1)) {
                        infoMap.set(parseInt(skinId), {
                            price: skinData.cost === -1 ? skinData.saleCost : skinData.cost,
                            rarity: skinData.rarityGem || 'None'
                        });
                    }
                }
                setSkinInfo(infoMap);
            })
            .catch(error => console.error("Failed to fetch skin prices:", error));
    }, []);

    useEffect(() => {
        // Once we have the latest version, fetch all champion data
        if (!latestVersion) return;

        fetch(CHAMPION_SUMMARY_URL(latestVersion))
            .then(res => res.json())
            .then(data => {
                const championList: Champion[] = Object.values(data.data);
                setChampions(championList);
                setIsLoading(false); // Data is ready, stop loading
                
                // Pre-cache details in the background
                championList.forEach(champ => {
                    fetch(CHAMPION_DETAIL_URL(latestVersion, champ.id))
                        .then(res => res.json())
                        .then(detailData => {
                            setChampionDetailsCache(prevCache => {
                                const newCache = new Map(prevCache);
                                newCache.set(champ.id, detailData.data[champ.id]);
                                return newCache;
                            });
                        });
                });
            });
    }, [latestVersion]);

    useEffect(() => {
        localStorage.setItem('favoriteSkins', JSON.stringify(favorites));
        // Preload images for favorited skins for instant hover effect
        favorites.forEach(fav => {
            const img = new Image();
            img.src = CENTERED_SKIN_IMAGE_URL(fav.championId, fav.num);
        });
    }, [favorites]);

    const handleToggleFavorite = useCallback((skin: Skin, championInfo: {id: string, name: string}) => {
        setFavorites(prev => {
            const existingIndex = prev.findIndex(fav => fav.id === skin.id);
            if (existingIndex > -1) {
                return prev.filter((_, index) => index !== existingIndex);
            } else {
                return [...prev, { ...skin, championId: championInfo.id, championName: championInfo.name }];
            }
        });
    }, []);

    const filteredChampions = useMemo(() =>
        champions.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())),
        [champions, searchTerm]
    );
    
    const totalRp = useMemo(() => {
        return favorites.reduce((acc, fav) => {
            const info = skinInfo.get(parseInt(fav.id));
            if (info && info.price) {
                return acc + info.price;
            }
            return acc;
        }, 0);
    }, [favorites, skinInfo]);


    if (isLoading) {
        return (
            <div style={{ ...styles.appContainer, justifyContent: 'center', alignItems: 'center', fontSize: '1.5em' }}>
                Loading latest skin data...
            </div>
        );
    }

    return (
        <div style={styles.appContainer} className="app-container">
            <div style={styles.favoritesPanel} className="favorites-panel">
                {hoveredFavorite && (
                    <div style={styles.favoriteArtPreview}>
                        <img 
                            src={CENTERED_SKIN_IMAGE_URL(hoveredFavorite.championId, hoveredFavorite.num)}
                            style={styles.favoriteArtImage}
                            alt=""
                        />
                    </div>
                )}
                <h2>Favorite Skins</h2>
                <div style={styles.favoritesList} className="favorites-list">
                    {favorites.length > 0 ? (
                        <ul>
                            {favorites.map(fav => {
                                const info = skinInfo.get(parseInt(fav.id));
                                return (
                                    <li 
                                        key={fav.id}
                                        onMouseEnter={() => setHoveredFavorite(fav)}
                                        onMouseLeave={() => setHoveredFavorite(null)}
                                    >
                                        <div style={styles.favoriteItemInfo}>
                                            <span>{fav.name === 'default' ? fav.championName : fav.name}</span>
                                            <small>{fav.championName}</small>
                                            <div style={{marginTop: '4px'}}>
                                                {info && info.price > 0 && <span style={{...styles.rpPrice, fontSize: '0.8em', padding: '2px 6px'}}>{info.price} RP</span>}
                                                {info && <RarityBadge rarity={info.rarity} />}
                                            </div>
                                        </div>
                                        <button 
                                            style={styles.removeFavoriteButton}
                                            className="remove-favorite-button"
                                            onClick={() => handleToggleFavorite(fav, {id: fav.championId, name: fav.championName})}
                                        >
                                            &times;
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <p style={{textAlign: 'center', opacity: 0.7}}>Your favorite skins will appear here.</p>
                    )}
                </div>
                <div style={styles.totalRpContainer}>
                    <strong>Total Cost:</strong>
                    <span>{totalRp.toLocaleString()} RP</span>
                </div>
            </div>
            <div style={styles.mainPanel} className="main-panel">
                <div style={styles.mainHeader}>
                    <h2>All Champions</h2>
                    <input
                        type="text"
                        placeholder="Search Champion..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={styles.searchInput}
                    />
                </div>
                <div style={styles.championGrid} className="champion-grid">
                    {filteredChampions.map(champion => (
                        <div key={champion.id} style={styles.championCard} className="champion-card" onClick={() => setSelectedChampion(champion)}>
                            <img src={CHAMPION_ICON_URL(latestVersion!, champion.id)} alt={champion.name} style={styles.championImage} className="champion-image" />
                            <span style={styles.championName}>{champion.name}</span>
                        </div>
                    ))}
                </div>
            </div>

            {selectedChampion && latestVersion && (
                <SkinModal
                    champion={selectedChampion}
                    onClose={() => setSelectedChampion(null)}
                    favorites={favorites}
                    onToggleFavorite={handleToggleFavorite}
                    championDetailsCache={championDetailsCache}
                    skinInfo={skinInfo}
                    apiVersion={latestVersion}
                />
            )}
        </div>
    );
};

// --- Styles ---
const styles: { [key: string]: React.CSSProperties } = {
    appContainer: {
        display: 'flex',
        height: '100vh',
        fontFamily: "'Roboto', sans-serif",
        backgroundColor: '#0a101b',
        color: '#c4b998',
    },
    favoritesPanel: {
        width: '350px',
        backgroundColor: '#010a13',
        borderRight: '2px solid #242a30',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
    },
    favoritesList: {
        overflowY: 'auto',
        flex: 1,
    },
    mainPanel: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
    },
    mainHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 20px',
        borderBottom: '2px solid #242a30',
    },
    championGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
        gap: '20px',
        padding: '20px',
        overflowY: 'auto',
    },
    championCard: {
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'transform 0.2s',
    },
    championImage: {
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        border: '3px solid #c4b998',
        transition: 'border-color 0.2s',
    },
    championName: {
        display: 'block',
        marginTop: '8px',
        fontSize: '0.9em',
        fontWeight: 500,
    },
    searchInput: {
        padding: '8px 12px',
        borderRadius: '4px',
        border: '1px solid #c4b998',
        backgroundColor: '#0a101b',
        color: '#c4b998',
        fontSize: '1em',
    },
    modalOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    modalContent: {
        position: 'relative',
        backgroundColor: '#010a13',
        border: '2px solid #c4b998',
        borderRadius: '8px',
        padding: '20px',
        width: '90%',
        maxWidth: '1200px',
        textAlign: 'center'
    },
    closeButton: {
        position: 'absolute',
        top: '10px',
        right: '20px',
        background: 'none',
        border: 'none',
        color: '#c4b998',
        fontSize: '2.5rem',
        cursor: 'pointer',
    },
    carouselContainer: {
        position: 'relative',
        width: '100%',
        height: '70vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    carouselImage: {
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        userSelect: 'none',
    },
    carouselButton: {
        position: 'absolute',
        top: '50%',
        transform: 'translateY(-50%)',
        backgroundColor: 'rgba(0,0,0,0.5)',
        color: 'white',
        border: 'none',
        fontSize: '2rem',
        padding: '10px',
        cursor: 'pointer',
        userSelect: 'none',
        zIndex: 2,
    },
    carouselButtonPrev: { left: '10px' },
    carouselButtonNext: { right: '10px' },
    skinInfo: {
        marginTop: '15px'
    },
    rpPrice: {
        backgroundColor: '#1e282d',
        color: '#cdbe93',
        padding: '4px 10px',
        borderRadius: '10px',
        fontWeight: 'bold',
        display: 'inline-block',
        verticalAlign: 'middle',
    },
    favoriteButton: {
        background: 'none',
        border: 'none',
        fontSize: '2rem',
        cursor: 'pointer',
        marginLeft: '15px',
        verticalAlign: 'middle',
    },
    totalRpContainer: {
        padding: '20px',
        borderTop: '2px solid #242a30',
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '1.2em',
        backgroundColor: '#0a101b'
    },
    favoriteArtPreview: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
    },
    favoriteArtImage: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        opacity: 0.1,
        transition: 'opacity 0.3s ease-in-out',
    },
    favoriteItemInfo: {
        display: 'flex',
        flexDirection: 'column',
    },
    removeFavoriteButton: {
        background: 'none',
        border: '1px solid #555',
        color: '#888',
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        cursor: 'pointer',
        fontSize: '1rem',
        lineHeight: '22px',
        textAlign: 'center',
        opacity: 0.5,
        transition: 'all 0.2s',
    },
};

// --- Dynamic Stylesheet ---
const styleSheet = document.createElement("style")
styleSheet.innerText = `
    .favorites-list ul { list-style: none; padding: 0; margin: 0; }
    .favorites-list li { 
        padding: 10px 15px; 
        border-bottom: 1px solid #1a2027; 
        display: flex;
        justify-content: space-between;
        align-items: center;
        position: relative;
        z-index: 1;
        background-color: transparent;
        transition: background-color 0.2s;
    }
    .favorites-list li:hover {
        background-color: rgba(196, 185, 152, 0.1);
    }
    .favorites-list li small { opacity: 0.6; font-size: 0.8em; margin-top: 2px; }

    #root ::-webkit-scrollbar { width: 8px; }
    #root ::-webkit-scrollbar-track { background: #010a13; }
    #root ::-webkit-scrollbar-thumb { background: #242a30; border-radius: 4px; }
    #root ::-webkit-scrollbar-thumb:hover { background: #c4b998; }
    .champion-card:hover { transform: scale(1.1); }
    .champion-card:hover .champion-image { border-color: #f0e6d2; }

    .remove-favorite-button:hover {
        opacity: 1 !important;
        background-color: #c4b998 !important;
        color: #010a13 !important;
        border-color: #c4b998 !important;
    }

    /* --- Responsive Styles --- */
    @media (max-width: 800px) {
        .app-container {
            flex-direction: column;
            height: auto;
            min-height: 100vh;
        }
        .favorites-panel {
            width: 100%;
            height: 40vh;
            max-height: 350px;
            border-right: none;
            border-bottom: 2px solid #242a30;
        }
        .main-panel {
            height: auto;
        }
        .champion-grid {
            grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
            gap: 15px;
            padding: 15px;
        }
        .champion-image {
            width: 65px;
            height: 65px;
        }
        .main-header h2 {
            font-size: 1.2em;
        }
        .searchInput {
            font-size: 0.9em;
        }
    }
`
document.head.appendChild(styleSheet);


const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);