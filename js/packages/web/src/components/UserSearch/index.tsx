import { shortenAddress } from '@oyster/common';
import { Select, Button } from 'antd';
import React, { useState, useEffect } from 'react';
import { useMeta } from '../../contexts';
import { Royalty } from '../../views/artCreate';

export interface UserValue {
  key: string;
  label: string;
  value: string;
}

export const UserSearch = (props: { royalties: Array<Royalty> , setCreators: Function, setShowCreatorsModal: Function }) => {
  const { whitelistedCreatorsByCreator } = useMeta();
  const [options, setOptions] = useState<UserValue[]>([]);
  const [selected, setSelected] = useState<UserValue[]>();
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(selected !== undefined && selected.length > 0 ? true : false);
  }, [selected])

  function onChange(value) {
    setSelected(value);
  }
  
  function onFocus() {
    const mapped = Object.keys(whitelistedCreatorsByCreator);
    const opts = props.royalties.map(item => item.creatorKey);
    const intersection = mapped.filter(creator => !opts.includes(creator))
      .map<UserValue>((value, index) => ({
        key: index.toString(),
        label: shortenAddress(value).toString(),
        value: value,
      }));
    setOptions(intersection);
  }

  function handleFormSubmit (event) {
    event.preventDefault();
    props.setCreators(selected);
    setSelected([]);
    props.setShowCreatorsModal(false);
  }

  return (
    <div>
      <Select
        showSearch
        labelInValue
        mode="multiple"
        allowClear
        style={{ width: '100%', color: 'black' }}
        onChange={onChange}
        onFocus={onFocus}
        optionLabelProp="label"
        options={options}
        value={selected}
        notFoundContent={(
          <p>You don't have more creators available to add</p>
        )}
      />
      <Button disabled={!active} style={{ marginTop: "1rem" }} onClick={ handleFormSubmit }>Confirm</Button>
    </div>
  );
};
