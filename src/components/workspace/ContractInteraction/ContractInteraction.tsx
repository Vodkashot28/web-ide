import { UserContract, useContractAction } from '@/hooks/contract.hooks';
import { useLogActivity } from '@/hooks/logActivity.hooks';
import { useWorkspaceActions } from '@/hooks/workspace.hooks';
import {
  ABI,
  ContractLanguage,
  NetworkEnvironment,
} from '@/interfaces/workspace.interface';
import { buildTs } from '@/utility/typescriptHelper';
import { SandboxContract } from '@ton-community/sandbox';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { Button, Form, message } from 'antd';
import { FC, useEffect, useRef, useState } from 'react';
import ABIUi from '../ABIUi';
import OpenFile from '../OpenFile/OpenFile';
import { globalWorkspace } from '../globalWorkspace';
import s from './ContractInteraction.module.scss';

interface Props {
  contractAddress: string;
  projectId: string;
  abi: ABI | null;
  network: NetworkEnvironment;
  contract: SandboxContract<UserContract> | null;
  language?: ContractLanguage;
}
const ContractInteraction: FC<Props> = ({
  contractAddress,
  projectId,
  abi,
  network,
  contract = null,
  language = 'func',
}) => {
  const [tonConnector] = useTonConnectUI();
  const [isLoading, setIsLoading] = useState('');
  const { sendMessage } = useContractAction();
  const { getFileByPath } = useWorkspaceActions();
  const { createLog } = useLogActivity();
  const { sandboxWallet: wallet } = globalWorkspace;

  const cellBuilderRef = useRef<HTMLIFrameElement>(null);

  const createCell = async () => {
    if (!cellBuilderRef.current?.contentWindow) return;
    const contractCellContent = await getFileByPath(
      'message.cell.ts',
      projectId
    );
    if (contractCellContent && !contractCellContent.content) {
      throw 'Cell data is missing in file message.cell.ts';
    }
    if (!contractCellContent?.content?.includes('cell')) {
      throw 'cell variable is missing in file message.cell.ts';
    }
    try {
      const jsOutout = await buildTs(
        {
          'message.cell.ts': contractCellContent?.content,
          'cell.ts': 'import cell from "./message.cell.ts"; cell;',
        },
        'cell.ts'
      );
      const finalJsoutput = jsOutout[0].code
        .replace(/^import\s+{/, 'const {')
        .replace(/}\s+from\s.+/, '} = window.TonCore;');

      cellBuilderRef.current.contentWindow.postMessage(
        {
          name: 'nujan-ton-ide',
          type: 'abi-data',
          code: finalJsoutput,
        },
        '*'
      );
    } catch (error: any) {
      setIsLoading('');
      if (error.message.includes("'default' is not exported by ")) {
        throw "'default' is not exported by message.cell.ts";
      }
      createLog(
        'Something went wrong. Check browser console for details.',
        'error'
      );
      throw error;
    }
  };

  const onSubmit = async (formValues: any) => {
    if (!tonConnector) {
      message.warning('Wallet not connected');
      return;
    }

    try {
      setIsLoading('setter');
      await createCell();
    } catch (error: any) {
      setIsLoading('');
      console.log(error);
      if (typeof error === 'string') {
        createLog(error, 'error');
        return;
      }
      if (error.message.includes('Wrong AccessKey used for')) {
        createLog('Contract address changed. Relogin required.', 'error');
      }
    } finally {
      setIsLoading('');
    }
  };

  useEffect(() => {
    const handler = async (
      event: MessageEvent<{ name: string; type: string; data: any }>
    ) => {
      if (
        !event.data ||
        typeof event.data !== 'object' ||
        event.data?.type !== 'abi-data' ||
        event.data?.name !== 'nujan-ton-ide'
      ) {
        setIsLoading('');
        return;
      }

      try {
        if (!tonConnector && network !== 'SANDBOX') {
          message.warning('Wallet not connected');
          return;
        }

        await send(event.data.data);
        createLog('Message sent successfully', 'success');
      } catch (error) {
        console.log('error', error);
      } finally {
        setIsLoading('');
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [isLoading, tonConnector, network, contractAddress, contract]);

  const send = async (data: string) => {
    sendMessage(data, contractAddress, contract, network, wallet!!);
  };

  if (!contractAddress) {
    return <></>;
  }

  return (
    <div className={s.root}>
      <iframe
        className={s.cellBuilderRef}
        ref={cellBuilderRef}
        src="/html/tonweb.html"
        sandbox="allow-scripts  allow-same-origin"
      />
      <p>
        This will be used to send internal message and call getter method on
        contract
      </p>
      <br />

      {abi && abi.getters.length > 0 && (
        <>
          <h3 className={s.label}>Getters ({abi.getters.length}):</h3>
          {abi.getters.map((item, i) => (
            <ABIUi
              abi={item}
              key={i}
              contractAddress={contractAddress}
              network={network}
              contract={contract}
              language={language}
            />
          ))}
        </>
      )}
      <br />

      <h3 className={s.label}>Send internal message:</h3>
      {language !== 'tact' && (
        <>
          <p>
            Update cell data in{' '}
            <OpenFile
              projectId={projectId}
              name="message.cell.ts"
              path="message.cell.ts"
            />{' '}
            and then send message
          </p>
          <Form className={s.form} onFinish={onSubmit}>
            <Button
              type="default"
              htmlType="submit"
              loading={isLoading === 'setter'}
              className={s.sendMessage}
            >
              Send
            </Button>
          </Form>
        </>
      )}
    </div>
  );
};

export default ContractInteraction;
