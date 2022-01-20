import React, { useEffect, useState } from 'react';
import { ArtCard } from '../../components/ArtCard';
import { Layout, Row, Col, Tabs, Button } from 'antd';
import Masonry from 'react-masonry-css';
import { Link } from 'react-router-dom';
import { useCreatorArts, useUserArts } from '../../hooks';
import { useMeta } from '../../contexts';
import { CardLoader } from '../../components/MyLoader';
import { useWallet } from '@solana/wallet-adapter-react';
import { Spinner } from '../../components/Loader';

const { TabPane } = Tabs;

const { Content } = Layout;

export enum ArtworkViewState {
  Metaplex = '0',
  Owned = '1',
  Created = '2',
}

export const ArtworksView = () => {
  const { connected, publicKey } = useWallet();
  const ownedMetadata = useUserArts();
  const createdMetadata = useCreatorArts(publicKey?.toBase58() || '');
  const { metadata, isLoading, pullAllMetadata, storeIndexer } = useMeta();
  const [activeKey, setActiveKey] = useState(ArtworkViewState.Metaplex);
  const breakpointColumnsObj = {
    default: 4,
    1100: 3,
    700: 2,
    500: 1,
  };
  const [loading, setLoading] = useState(true);

  const items =
    activeKey === ArtworkViewState.Owned
      ? ownedMetadata.map(m => m.metadata)
      : activeKey === ArtworkViewState.Created
      ? createdMetadata
      : metadata;

  useEffect(() => {
    if (connected) {
      setActiveKey(ArtworkViewState.Owned);
    } else {
      setActiveKey(ArtworkViewState.Metaplex);
    }
  }, [connected, setActiveKey]);

  useEffect(() => {
    isLoading ? setLoading(true) : setLoading(false);
  }, [isLoading])

  const refreshButton = connected && storeIndexer.length !== 0 && (
    <Button onClick={() => {
      pullAllMetadata();
    }}>Load all metadata</Button>
  );

  // Packs artworkGrid, some of the code in this file was remove and could be reviewed
  // on the metaplex foundation repo
  // const isDataLoading = isLoading || isFetching;
  // const artworkGrid = (
  //   <div className="artwork-grid">
  //     {isDataLoading && [...Array(10)].map((_, idx) => <CardLoader key={idx} />)}
  //     {!isDataLoading &&
  //       userItems.map(item => {
  //         const pubkey = isMetadata(item)
  //           ? item.pubkey
  //           : isPack(item)
  //           ? item.provingProcessKey
  //           : item.edition?.pubkey || item.metadata.pubkey;

  //         return <ItemCard item={item} key={pubkey} />;
  //       })}
  //   </div>
  // );

  const artworkGrid = (
    <div>
      {loading &&
        <div className="masonry-div">
          <div className="masonry-div-content">
            <h1>LOADING</h1>
            <Spinner></Spinner>
          </div>
          <Masonry
            breakpointCols={breakpointColumnsObj}
            className="masonry-grid"
            columnClassName="masonry-grid_column"
          >
            {isLoading &&
              [...Array(10)].map((_, idx) => <CardLoader key={idx} />)
            }
          </Masonry>
        </div>
      }
      {!loading &&
        <div className="masonry-div">
          <Masonry
            breakpointCols={breakpointColumnsObj}
            className="masonry-grid"
            columnClassName="masonry-grid_column"
          >
            {!isLoading &&
              items.map((m, idx) => {
                const id = m.pubkey;
                return (
                  <Link to={`/art/${id}`} key={idx}>
                    <ArtCard
                      key={id}
                      pubkey={m.pubkey}
                      preview={false}
                      height={250}
                      width={250}
                    />
                  </Link>
                );
              })
            }
          </Masonry>
        </div>
      }
    </div>
  );

  return (
    <Layout style={{ margin: 0, marginTop: 30 }}>
      <Content className="items-content">
        <Col style={{ width: '100%', marginTop: 10 }}>
          <Row>
            <Tabs
              activeKey={activeKey}
              onTabClick={key => setActiveKey(key as ArtworkViewState)}
              tabBarExtraContent={refreshButton}
            >
              <TabPane
                tab={<span className="tab-title">All</span>}
                key={ArtworkViewState.Metaplex}
              >
                {artworkGrid}
              </TabPane>
              {connected && (
                <TabPane
                  tab={<span className="tab-title">Owned</span>}
                  key={ArtworkViewState.Owned}
                >
                  {artworkGrid}
                </TabPane>
              )}
              {connected && (
                <TabPane
                  tab={<span className="tab-title">Created</span>}
                  key={ArtworkViewState.Created}
                >
                  {artworkGrid}
                </TabPane>
              )}
            </Tabs>
          </Row>
        </Col>
      </Content>
    </Layout>
  );
};