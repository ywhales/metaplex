import { useWallet } from '@solana/wallet-adapter-react';
import { Col, Layout, Row, Tabs } from 'antd';
import React, { useState, useEffect } from 'react';
import Masonry from 'react-masonry-css';

import { useMeta } from '../../../../contexts';
import { CardLoader } from '../../../../components/MyLoader';
import { Banner } from '../../../../components/Banner';
import { HowToBuyModal } from '../../../../components/HowToBuyModal';
import { Spinner } from '../../../../components/Loader';

import { useSales } from './hooks/useSales';
import SaleCard from './components/SaleCard';

const { TabPane } = Tabs;
const { Content } = Layout;

export enum LiveAuctionViewState {
  All = '0',
  Participated = '1',
  Ended = '2',
  Resale = '3',
}

const breakpointColumnsObj = {
  default: 4,
  1100: 3,
  700: 2,
  500: 1,
};

export const SalesListView = () => {
  const [activeKey, setActiveKey] = useState(LiveAuctionViewState.All);
  const { isLoading } = useMeta();
  const { connected } = useWallet();
  const { sales, hasResaleAuctions } = useSales(activeKey);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading) {
      setLoading(false);
    }
  }, [isLoading])

  return (
    <>
      <Banner
        src={'/main-banner.png'}
        headingText={'Welcome to YWhales Martketplace'}
        subHeadingText={'Buy exclusive NFTs.'}
        actionComponent={<HowToBuyModal buttonClassName="secondary-btn" />}
        useBannerBg
      />
      <Layout>
        <Content style={{ display: 'flex', flexWrap: 'wrap' }}>
          <Col style={{ width: '100%', marginTop: 32, overflow: "hidden" }}>
            <Row>
              <Tabs
                activeKey={activeKey}
                onTabClick={key => setActiveKey(key as LiveAuctionViewState)}
              >
                <TabPane
                  tab={
                    <>
                      <span className="live"></span> Live
                    </>
                  }
                  key={LiveAuctionViewState.All}
                ></TabPane>
                {hasResaleAuctions && (
                  <TabPane
                    tab="Secondary Marketplace"
                    key={LiveAuctionViewState.Resale}
                  ></TabPane>
                )}
                <TabPane tab="Ended" key={LiveAuctionViewState.Ended}></TabPane>
                {connected && (
                  <TabPane
                    tab="Participated"
                    key={LiveAuctionViewState.Participated}
                  ></TabPane>
                )}
              </Tabs>
            </Row>
            <Row>
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
                      [...Array(10)]  .map((_, idx) => <CardLoader key={idx} />)}
                  </Masonry>
                </div>
              }
              {!loading &&
                  <Masonry
                    breakpointCols={breakpointColumnsObj}
                    className="masonry-grid"
                    columnClassName="masonry-grid_column"
                  >
                    {!isLoading &&
                      sales.map((sale, idx) => <SaleCard sale={sale} key={idx} />)}
                  </Masonry>
              }
            </Row>
          </Col>
        </Content>
      </Layout>
    </>
  );
};
