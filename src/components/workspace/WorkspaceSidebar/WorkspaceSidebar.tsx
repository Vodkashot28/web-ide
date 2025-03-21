import { ThemeContext } from '@/components/shared/ThemeProvider';
import { Tooltip } from '@/components/ui';
import AppIcon, { AppIconType } from '@/components/ui/icon';
import { AppData } from '@/constant/AppData';
import { useSettingAction } from '@/hooks/setting.hooks';
import { Form, Input, Popover, Select, Switch } from 'antd';
import Link from 'next/link';
import { FC, useContext } from 'react';
import s from './WorkspaceSidebar.module.scss';

export type WorkSpaceMenu =
  | 'code'
  | 'build'
  | 'test-cases'
  | 'setting'
  | 'misti'
  | 'git';
interface MenuItem {
  label: string;
  value: WorkSpaceMenu;
  icon: string;
  private?: boolean;
}

interface Props {
  activeMenu: WorkSpaceMenu;
  onMenuClicked: (name: WorkSpaceMenu) => void;
  projectName?: string | null;
}

const WorkspaceSidebar: FC<Props> = ({ activeMenu, onMenuClicked }) => {
  const {
    isContractDebugEnabled,
    toggleContractDebug,
    isFormatOnSave,
    toggleFormatOnSave,
    updateTonAmountForInteraction,
    getTonAmountForInteraction,
    isAutoBuildAndDeployEnabled,
    toggleAutoBuildAndDeploy,
    getSettingStateByKey,
    updateEditorMode,
    toggleExternalMessage,
  } = useSettingAction();

  const editorMode = getSettingStateByKey('editorMode');
  const isExternalMessage = getSettingStateByKey('isExternalMessage');

  const themeContext = useContext(ThemeContext);

  const menuItems: MenuItem[] = [
    {
      label: 'Code',
      value: 'code',
      icon: 'Code',
    },
    {
      label: 'Build & Deploy',
      value: 'build',
      icon: 'Beaker',
    },
    {
      label: 'Unit Test',
      value: 'test-cases',
      icon: 'Test',
    },
    {
      label: 'Misti Static Analyzer',
      value: 'misti',
      icon: 'CodeScan',
    },
    {
      label: 'Git',
      value: 'git',
      icon: 'GitBranch',
    },
  ];

  const settingContent = () => (
    <div>
      <div className={s.settingItem}>
        <Form.Item
          style={{ marginBottom: 0 }}
          label="Debug Contract"
          valuePropName="checked"
        >
          <Switch
            checked={isContractDebugEnabled()}
            onChange={(toggleState) => {
              toggleContractDebug(toggleState);
            }}
          />
        </Form.Item>
        <p>
          *{' '}
          <small>
            Contract rebuild and redeploy <br /> required after an update
          </small>
        </p>
      </div>
      <div className={s.settingItem}>
        <Form.Item label="External Message" valuePropName="checked">
          <Switch
            checked={!!isExternalMessage}
            onChange={(toggleState) => {
              toggleExternalMessage(toggleState);
            }}
          />
        </Form.Item>
      </div>
      <div className={s.settingItem}>
        <Form.Item label="Format code on save" valuePropName="checked">
          <Switch
            checked={isFormatOnSave()}
            onChange={(toggleState) => {
              toggleFormatOnSave(toggleState);
            }}
          />
        </Form.Item>
      </div>
      <div className={s.settingItem}>
        <Form.Item label="Light Mode" valuePropName="checked">
          <Switch
            checked={themeContext?.theme === 'light'}
            onChange={() => {
              themeContext?.toggleTheme();
            }}
          />
        </Form.Item>
      </div>
      <div className={s.settingItem}>
        <Form.Item
          label="Auto Build & Deploy in Sandbox"
          valuePropName="checked"
        >
          <Switch
            checked={isAutoBuildAndDeployEnabled()}
            onChange={(toggleState) => {
              toggleAutoBuildAndDeploy(toggleState);
            }}
          />
        </Form.Item>
        <p>
          *{' '}
          <small>
            Automatically build and deploy the smart contract after the file is
            saved <br /> if the environment is set to Sandbox.
          </small>
        </p>
      </div>
      <div className={s.settingItem}>
        <Form.Item label="Editor Mode">
          <Select
            style={{ width: '10rem' }}
            value={editorMode}
            onChange={(value) => {
              updateEditorMode(value as 'default' | 'vim');
            }}
          >
            <Select.Option value="default">Default</Select.Option>
            <Select.Option value="vim">Vim</Select.Option>
          </Select>
        </Form.Item>
      </div>

      <div className={s.settingItem}>
        <Form.Item
          style={{ marginBottom: 0 }}
          label="TON Amount for Interaction"
        >
          <Input
            style={{ marginBottom: 0, width: '6rem' }}
            value={getTonAmountForInteraction() as string}
            onChange={(e) => {
              if (isNaN(Number(e.target.value))) return;
              updateTonAmountForInteraction(e.target.value);
            }}
            placeholder="in TON"
            suffix={
              <div
                title="Reset"
                className={s.resetAmount}
                onClick={() => {
                  updateTonAmountForInteraction('', true);
                }}
              >
                <AppIcon name="Reload" />
              </div>
            }
          />
        </Form.Item>
        <p>
          *{' '}
          <small>
            This amount will be used for all the <br /> contract interaction
            like deployment and sending internal messages.
          </small>
        </p>
      </div>
    </div>
  );

  return (
    <div className={s.container}>
      <div>
        {menuItems.map((menu, i) => {
          if (menu.private) {
            return;
          }
          return (
            <Tooltip key={i} title={menu.label} placement="right">
              <div
                className={`${s.action} ${
                  activeMenu === menu.value ? s.isActive : ''
                }`}
                onClick={() => {
                  onMenuClicked(menu.value);
                }}
              >
                <AppIcon className={s.icon} name={menu.icon as AppIconType} />
              </div>
            </Tooltip>
          );
        })}
      </div>
      <div>
        {AppData.socials.map((menu, i) => (
          <Tooltip key={i} title={menu.label} placement="right">
            <Link href={menu.url} className={s.action} target="_blank">
              <AppIcon className={s.icon} name={menu.icon as AppIconType} />
            </Link>
          </Tooltip>
        ))}

        <Popover placement="rightTop" title="Setting" content={settingContent}>
          <div className={s.action}>
            <AppIcon className={s.icon} name="Setting" />
          </div>
        </Popover>
        <Tooltip title="Switch Theme" placement="right">
          <div
            className={`${s.themeSwitch} ${s.action} ${s.isActive}`}
            onClick={() => {
              themeContext?.toggleTheme();
            }}
          >
            {themeContext?.theme == 'dark' ? (
              <AppIcon name="Moon" />
            ) : (
              <AppIcon name="Sun" />
            )}
          </div>
        </Tooltip>
      </div>
    </div>
  );
};

export default WorkspaceSidebar;
