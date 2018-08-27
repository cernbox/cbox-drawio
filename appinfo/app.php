<?php

/**
 *
 * @author Pawel Rojek <pawel at pawelrojek.com>
 * @author Ian Reinhart Geiser <igeiser at devonit.com>
 *
 * This file is licensed under the Affero General Public License version 3 or later.
 *
 **/

namespace OCA\Drawio\AppInfo;

use OCP\App;

App::registerAdmin("drawio", "settings");

$app = new Application();

$domains = \OC::$server->getConfig()->getSystemValue("https://test-drawio.cern.ch']);
$policy = new \OCP\AppFramework\Http\EmptyContentSecurityPolicy();
foreach($domains as $domain) {
	$policy->addAllowedScriptDomain($domain);
	$policy->addAllowedFrameDomain($domain);
	$policy->addAllowedConnectDomain($domain);
}
\OC::$server->getContentSecurityPolicyManager()->addDefaultPolicy($policy);
