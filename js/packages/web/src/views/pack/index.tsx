import React, { useState } from 'react';
import { Row, Col } from 'antd';

import RedeemModal from './components/RedeemModal';
import PackSidebar from './components/PackSidebar';
import { useMeta } from '@oyster/common';
import { useParams } from 'react-router';

export const PackView = () => {
  const [openModal, setOpenModal] = useState(false);
  const { provingProcess, pack } = usePack();

  const cardsRedeemed = provingProcess?.info.cardsRedeemed || 0;
  const packSize = pack?.info.allowedAmountToRedeem || 0;
  const cards = useMemo(
    () => Array.from({ length: packSize }, (_, i) => i),
    [packSize, cardsRedeemed],
  );

  const total = pack?.info?.allowedAmountToRedeem || 0;
  const mockBlocks = Array.from({ length: total }, (v, i) => i);

  return (
    <div className="pack-view">
      <Row>
        <Col md={16}>
          <div className="pack-view__list">
            {cards.map(index => (
              <ArtCard key={index} index={index} isModalOpened={openModal} />
            ))}
          </div>
        </Col>
        <Col md={8}>
          <PackSidebar pack={pack} />
        </Col>
      </Row>

      <RedeemModal
        isModalVisible={openModal}
        onClose={() => setOpenModal(false)}
      />
    </div>
  );
};
