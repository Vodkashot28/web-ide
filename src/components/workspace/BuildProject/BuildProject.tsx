import TonAuth from '@/components/auth/TonAuth/TonAuth';
import { useContractAction } from '@/hooks/contract.hooks';
import { useLogActivity } from '@/hooks/logActivity.hooks';
import { useWorkspaceActions } from '@/hooks/workspace.hooks';
import { NetworkEnvironment } from '@/interfaces/workspace.interface';
import { Analytics } from '@/utility/analytics';
import { buildTs } from '@/utility/typescriptHelper';
import { getContractLINK } from '@/utility/utils';
import { Network } from '@orbs-network/ton-access';
import {
  Blockchain,
  SandboxContract,
  TreasuryContract,
} from '@ton-community/sandbox';
import { CHAIN, useTonConnectUI } from '@tonconnect/ui-react';
import { Button, Form, Select } from 'antd';
import Link from 'next/link';
import { FC, useEffect, useRef, useState } from 'react';
import { Cell } from 'ton-core';
import ContractInteraction from '../ContractInteraction';
import ExecuteFile from '../ExecuteFile/ExecuteFile';
import OpenFile from '../OpenFile/OpenFile';
import s from './BuildProject.module.scss';
interface Props {
  projectId: string;
  onCodeCompile: (codeBOC: string) => void;
  sandboxBlockchain: Blockchain;
  contract: any;
  updateContract: (contractInstance: any) => void;
}
const BuildProject: FC<Props> = ({
  projectId,
  onCodeCompile,
  sandboxBlockchain,
  contract,
  updateContract,
}) => {
  const [isLoading, setIsLoading] = useState('');
  const { createLog } = useLogActivity();
  const [environment, setEnvironment] = useState<NetworkEnvironment>('SANDBOX');
  const [buildOutput, setBuildoutput] = useState<{
    contractBOC: string | null;
    dataCell: Cell | null;
  } | null>(null);
  const cellBuilderRef = useRef<HTMLIFrameElement>(null);
  const [tonConnector] = useTonConnectUI();
  const chain = tonConnector.wallet?.account.chain;

  const [sandboxWallet, setSandboxWallet] =
    useState<SandboxContract<TreasuryContract>>();

  const { Option } = Select;

  const {
    projectFiles,
    getFileByPath,
    updateProjectById,
    project,
    activeFile,
  } = useWorkspaceActions();

  const currentActiveFile = activeFile(projectId as string);

  const { deployContract } = useContractAction();

  const activeProject = project(projectId);

  const initDeploy = async () => {
    try {
      if (!tonConnector.connected && environment !== 'SANDBOX') {
        throw 'Please connect wallet';
      }
      if (chain && environment !== 'SANDBOX' && CHAIN[environment] !== chain) {
        throw `Please connect wallet to ${environment}`;
      }
      setIsLoading('deploy');
      await createStateInitCell();
    } catch (error: any) {
      setIsLoading('');
      if (typeof error === 'string') {
        createLog(error, 'error');
        return;
      }
    } finally {
    }
  };

  const deploy = async () => {
    createLog(
      `Deploying contract with code BOC -  ${activeProject?.contractBOC}`,
      'info'
    );
    try {
      const { address: _contractAddress, contract } = await deployContract(
        activeProject?.contractBOC as string,
        buildOutput?.dataCell as any,
        environment.toLowerCase() as Network,
        sandboxBlockchain,
        sandboxWallet!!
      );
      Analytics.track('Deploy project', {
        platform: 'IDE',
        type: 'TON-func',
        environment: environment.toLowerCase(),
      });
      createLog(
        `Contract deployed on <b><i>${environment}</i></b> <br /> Contract address: ${_contractAddress}  ${getContractLINK(
          _contractAddress,
          environment
        )}`,
        'success'
      );
      if (!_contractAddress) {
        return;
      }
      if (contract) {
        updateContract(contract);
      }

      updateProjectById(
        {
          contractAddress: _contractAddress,
        },
        projectId
      );
    } catch (error: any) {
      console.log(error);
    } finally {
      setIsLoading('');
    }
  };

  const createStateInitCell = async () => {
    if (!cellBuilderRef.current?.contentWindow) return;
    const stateInitContent = await getFileByPath(
      'stateInit.cell.ts',
      projectId
    );
    if (stateInitContent && !stateInitContent.content) {
      throw 'State init data is missing in file stateInit.cell.ts';
    }

    try {
      const jsOutout = await buildTs(
        {
          'stateInit.cell.ts': stateInitContent?.content,
          'cell.ts': 'import cell from "./stateInit.cell.ts"; cell;',
        },
        'cell.ts'
      );
      const finalJsoutput = jsOutout[0].code
        .replace(/^import\s+{/, 'const {')
        .replace(/}\s+from\s.+/, '} = window.TonCore;');

      cellBuilderRef.current.contentWindow.postMessage(
        {
          name: 'nujan-ton-ide',
          type: 'state-init-data',
          code: finalJsoutput,
        },
        '*'
      );
    } catch (error: any) {
      if (error.message.includes("'default' is not exported by ")) {
        throw "'default' is not exported by stateInit.cell.ts";
      }
      createLog(
        'Something went wrong. Check browser console for details.',
        'error'
      );
      throw error;
    }
  };

  const isContractInteraction = () => {
    let isValid =
      activeProject?.id && tonConnector && activeProject?.contractAddress
        ? true
        : false;

    if (environment === 'SANDBOX') {
      isValid = isValid && sandboxBlockchain ? true : false;
    }
    return isValid;
  };

  useEffect(() => {
    if (environment === 'SANDBOX') {
      (async () => {
        const wallet = await sandboxBlockchain.treasury('user');
        createLog(
          `Sandbox account created. Address: <i>${wallet.address.toString()}</i>`,
          'info',
          false
        );
        setSandboxWallet(wallet);
      })();
    }
  }, []);

  useEffect(() => {
    const handler = (
      event: MessageEvent<{
        name: string;
        type: string;
        data: any;
        error: string;
      }>
    ) => {
      if (
        !event.data ||
        typeof event.data !== 'object' ||
        event.data?.type !== 'state-init-data' ||
        event.data?.name !== 'nujan-ton-ide'
      ) {
        return;
      }
      if (event.data?.error) {
        createLog(event.data.error, 'error');
        return;
      }

      setBuildoutput((t: any) => {
        return {
          ...t,
          dataCell: event.data.data,
        };
      });
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    if (!buildOutput?.dataCell || !isLoading) return;
    deploy();
  }, [buildOutput?.dataCell]);

  return (
    <div className={`${s.root} onboarding-build-deploy`}>
      <h3 className={s.heading}>Build & Deploy</h3>
      <iframe
        className={s.cellBuilderRef}
        ref={cellBuilderRef}
        src="/html/tonweb.html"
        sandbox="allow-scripts strict-origin-when-cross-origin"
      />
      <Form.Item label="Environment" className={s.formItem}>
        <Select
          defaultValue="SANDBOX"
          onChange={(value) => setEnvironment(value as NetworkEnvironment)}
          options={[
            { value: 'SANDBOX', label: 'Sandbox' },
            { value: 'TESTNET', label: 'Testnet' },
            { value: 'MAINNET', label: 'Mainnet' },
          ]}
        />
      </Form.Item>

      {environment !== 'SANDBOX' && <TonAuth />}

      <p className={s.info}>
        1. Update initial contract state in{' '}
        <OpenFile
          projectId={projectId}
          name="stateInit.cell.ts"
          path="stateInit.cell.ts"
        />{' '}
      </p>

      <div className={s.actionWrapper}>
        <ExecuteFile
          file={currentActiveFile}
          projectId={projectId as string}
          label={environment === 'SANDBOX' ? 'Build and Deploy' : 'Build'}
          description="2. Select a contract file to build and deploy"
          allowedFile={['fc']}
          onCompile={() => {
            if (environment == 'SANDBOX') {
              initDeploy();
            }
          }}
        />
        {environment !== 'SANDBOX' && (
          <Button
            type="primary"
            loading={isLoading == 'deploy'}
            onClick={initDeploy}
            disabled={!currentActiveFile || !activeProject?.contractBOC}
          >
            Deploy
          </Button>
        )}
      </div>
      {/* {!activeProject?.contractBOC && (
        <p className={s.info}>Build your contract before deploy</p>
      )} */}

      {activeProject?.contractAddress!! && environment !== 'SANDBOX' && (
        <div className={`${s.contractAddress} wrap`}>
          <Link
            href={`https://${
              chain === CHAIN.TESTNET ? 'testnet.' : ''
            }tonscan.org/address/${activeProject?.contractAddress}`}
            target="_blank"
          >
            View Deployed Contract
          </Link>
        </div>
      )}

      {isContractInteraction() && (
        <div className={s.contractInteraction}>
          <ContractInteraction
            contractAddress={activeProject?.contractAddress!!}
            projectId={projectId}
            abi={activeProject?.abi || []}
            network={environment}
            contract={contract}
            wallet={sandboxWallet!!}
          />
        </div>
      )}
    </div>
  );
};

export default BuildProject;
